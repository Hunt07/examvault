
import { useState } from "react";
import { summarizeContent } from "../../services/geminiService";
import { Loader2, UploadCloud } from "lucide-react";

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
    <div className="p-8 max-w-4xl mx-auto bg-white dark:bg-dark-surface rounded-xl shadow-lg border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200">
      <h2 className="text-2xl font-bold mb-6">AI PDF Summary Test</h2>
      
      <div className="mb-6">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-zinc-600 rounded-lg cursor-pointer bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-8 h-8 mb-3 text-slate-400" />
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold">Click to upload</span> local PDF for analysis</p>
            </div>
            <input 
                type="file" 
                className="hidden" 
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            />
        </label>
      </div>

      {loading && (
          <div className="flex items-center gap-3 text-primary-600 dark:text-primary-400 mb-4">
              <Loader2 className="animate-spin" size={20} />
              <p className="font-semibold">Analyzing document...</p>
          </div>
      )}

      {result && (
          <div className="mt-6 p-6 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700">
              <h3 className="text-lg font-bold mb-4 border-b border-slate-200 dark:border-zinc-700 pb-2">Result:</h3>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{result}</pre>
          </div>
      )}
    </div>
  );
}
