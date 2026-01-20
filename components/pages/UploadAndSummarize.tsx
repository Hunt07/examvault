import { useState } from "react";
import { summarizeContent } from "../../services/geminiService";

export default function UploadAndSummarize() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const readAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file); // 🔥 REQUIRED
    });

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const base64 = await readAsBase64(file);

      console.log("MIME:", file.type);
      console.log("BASE64:", base64.slice(0, 40));

      const summary = await summarizeContent(
        "",
        base64,
        file.type
      );

      setResult(summary);
    } catch (e: any) {
      setResult(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
      />

      {loading && <p>Analyzing…</p>}

      <pre style={{ whiteSpace: "pre-wrap" }}>{result}</pre>
    </div>
  );
}
