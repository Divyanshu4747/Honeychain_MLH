"""
beesaathi.py

BeeSaathi - the Honey Chain AI chatbot.

A specialized assistant for beekeepers, speaking English/Hindi/Hinglish.
It can call the existing hive-health and honey-yield ML models as OpenAI
"tools" when the user has supplied real sensor readings in the chat.

STATELESS v1: each call to ask_beesaathi() is a fresh conversation with
no memory of earlier messages. No database, no session storage yet.
"""

import json
import os

from openai import OpenAI, OpenAIError
from pydantic import ValidationError

from app.ml_utils import predict_hive_health, predict_honey_yield
from app.schemas import HiveData, YieldData


SYSTEM_PROMPT = """
You are BeeSaathi, a friendly and professional AI assistant for the
"Honey Chain" smart beekeeping platform. You help beekeepers, including
rural and field users, understand and manage their hives.

You can:
- Explain hive health status and what it means.
- Explain honey yield predictions.
- Answer general beekeeping questions.
- Help users understand sensor readings and warnings.
- Suggest simple, practical next steps.

Speak in English, Hindi, or Hinglish depending on how the user writes to
you. Use simple, everyday language and avoid technical jargon, since many
users are rural/field beekeepers.

You have two tools:
- get_hive_health: predicts hive health (healthy / warning / critical)
  from temperature, humidity, hive_weight, and weight_change.
- get_honey_yield: predicts expected honey yield in kg from temperature,
  humidity, hive_weight, weight_change, rainfall, flowering_index, and
  previous_yield.

STRICT RULES:
- NEVER invent or guess sensor values. Only call a tool if the user has
  actually given you the real numeric readings it needs. If any values
  are missing, ask the user to provide them - do not assume or make up
  numbers.
- These tools produce AI PREDICTIONS, not confirmed measurements. Always
  make clear that a prediction is an estimate, not a guaranteed or exact
  real-world outcome (especially for honey yield).
- If you don't have enough information, or a tool returns an error, say
  so honestly instead of making something up.
- Keep replies concise, warm, and practical.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_hive_health",
            "description": (
                "Predict a beehive's health status (healthy, warning, or critical) "
                "from its current sensor readings. Only call this if the user has "
                "given you temperature, humidity, hive_weight and weight_change. "
                "If any of these are missing, ask the user for them instead of "
                "calling this tool."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "temperature": {"type": "number", "description": "Hive temperature in Celsius"},
                    "humidity": {"type": "number", "description": "Relative humidity, 0-100 percent"},
                    "hive_weight": {"type": "number", "description": "Total hive weight in kg, must be > 0"},
                    "weight_change": {"type": "number", "description": "Daily weight change in kg/day, can be negative"},
                },
                "required": ["temperature", "humidity", "hive_weight", "weight_change"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_honey_yield",
            "description": (
                "Predict the expected honey yield (kg) for a hive from its sensor "
                "readings. Only call this if the user has given you all seven values: "
                "temperature, humidity, hive_weight, weight_change, rainfall, "
                "flowering_index and previous_yield. If any are missing, ask the user "
                "for them instead of calling this tool. Always tell the user this is "
                "an AI estimate, not a guaranteed production amount."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "temperature": {"type": "number", "description": "Temperature in Celsius"},
                    "humidity": {"type": "number", "description": "Relative humidity, 0-100 percent"},
                    "hive_weight": {"type": "number", "description": "Hive weight in kg, must be > 0"},
                    "weight_change": {"type": "number", "description": "Daily weight change in kg/day, can be negative"},
                    "rainfall": {"type": "number", "description": "Rainfall in mm, must be >= 0"},
                    "flowering_index": {"type": "number", "description": "Flowering index between 0 and 1"},
                    "previous_yield": {"type": "number", "description": "Previous honey yield in kg, must be >= 0"},
                },
                "required": [
                    "temperature", "humidity", "hive_weight", "weight_change",
                    "rainfall", "flowering_index", "previous_yield",
                ],
            },
        },
    },
]

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

class BeeSaathiError(Exception):
    """Raised for any BeeSaathi-specific failure (missing key, Gemini error, tool error)."""


def _get_client() -> OpenAI:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise BeeSaathiError(
            "GEMINI_API_KEY is not set. Add it to your .env file or environment."
        )

    return OpenAI(
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )


def _run_tool(name: str, arguments: dict) -> dict:
    """Validate arguments and execute the matching ML prediction function."""
    try:
        if name == "get_hive_health":
            validated = HiveData(**arguments)
            return predict_hive_health(
                temperature=validated.temperature,
                humidity=validated.humidity,
                hive_weight=validated.hive_weight,
                weight_change=validated.weight_change,
            )

        if name == "get_honey_yield":
            validated = YieldData(**arguments)
            return predict_honey_yield(
                temperature=validated.temperature,
                humidity=validated.humidity,
                hive_weight=validated.hive_weight,
                weight_change=validated.weight_change,
                rainfall=validated.rainfall,
                flowering_index=validated.flowering_index,
                previous_yield=validated.previous_yield,
            )

        return {"error": f"Unknown tool '{name}'"}

    except ValidationError as ve:
        # Clean explanation the model can relay to the user - no raw stack trace
        return {"error": f"Invalid input for {name}: {ve.errors()}"}
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Failed to run {name}: {str(exc)}"}


def ask_beesaathi(user_message: str) -> str:
    """
    Send one stateless message to BeeSaathi and return its reply text.
    Handles OpenAI tool calling for get_hive_health / get_honey_yield.
    """
    client = _get_client()

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=messages,
            tools=TOOLS,
        )
    except OpenAIError as exc:
        raise BeeSaathiError(f"Gemini API error: {str(exc)}") from exc
    reply = response.choices[0].message

    # No tool needed - just return the answer
    if not reply.tool_calls:
        return reply.content or ""

    # Model wants to use one or more tools
    messages.append(reply.model_dump(exclude_unset=True))

    for tool_call in reply.tool_calls:
        tool_name = tool_call.function.name
        try:
            tool_args = json.loads(tool_call.function.arguments or "{}")
        except json.JSONDecodeError:
            tool_args = {}

        tool_result = _run_tool(tool_name, tool_args)

        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(tool_result),
        })

    try:
        final_response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=messages,
        )
    except OpenAIError as exc:
        raise BeeSaathiError(f"OpenAI API error: {str(exc)}") from exc

    return final_response.choices[0].message.content or ""
