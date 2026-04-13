const { GoogleGenAI } = require("@google/genai");
console.log("Exports:", Object.keys(require("@google/genai")));
try {
  const g = new GoogleGenAI({apiKey:'test'});
  console.log("Instance keys:", Object.keys(g));
  console.log("Models keys:", Object.keys(g.models));
} catch(e) {
  console.log("Error:", e.message);
}
