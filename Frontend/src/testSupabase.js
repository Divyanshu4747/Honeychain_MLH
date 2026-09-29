import { supabase } from "./supabase";

console.log("🔥 BlockBeez Supabase test is running!");

const { data, error } = await supabase
  .from("hives")
  .select("*");

console.log("Supabase Hives:", data);
console.log("Supabase Error:", error);