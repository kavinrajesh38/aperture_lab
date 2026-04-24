import React, { useState } from 'react';
import { motion } from "motion/react";
import { Upload, Sliders, Loader2, X } from 'lucide-react';
import { ParticleField } from "./ParticleField";
import { GoogleGenerativeAI } from "@google/generative-ai";

function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState("");
  const [view, setView] = useState('landing'); // 'landing' or 'editor'
  const [settings, setSettings] = useState({
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    vibrance: 0
  });

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setImage(compressedBase64);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
  setImage(null);
  setAdvice("");
  setSettings({
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    vibrance: 0
  });
};

const generateAdvice = async () => {
    if (!image) return alert("Please upload a photo first!");
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

      const base64Data = image.split(',')[1];
      
      // We ask for JSON so the code can actually read the numbers
      const prompt = `Act as a high-end automotive editor. Analyze this photo. 
      Provide your response in EXACTLY this JSON format:
      {
        "text": "3 bullet points of advice here",
        "exposure": number between -100 and 100,
        "contrast": number between -100 and 100,
        "highlights": number between -100 and 100,
        "shadows": number between -100 and 100,
        "vibrance": number between -100 and 100
      }
      Do not include any markdown formatting like \`\`\`json. Just the raw JSON object.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
      ]);

      const responseText = result.response.text();
      
      // Parse the JSON string into a Javascript Object
      const data = JSON.parse(responseText);

      // Update BOTH the text and the slider positions
      setAdvice(data.text);
      setSettings({
        exposure: data.exposure || 0,
        contrast: data.contrast || 0,
        highlights: data.highlights || 0,
        shadows: data.shadows || 0,
        vibrance: data.vibrance || 0
      });

    } catch (error) {
      console.error("Analysis Error:", error);
      alert("I couldn't read the AI's settings. Make sure the prompt is asking for JSON!");
    } finally {
      setLoading(false);
    }
  };

  const Slider = ({ label, value, min, max }) => (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className={value !== 0 ? "text-cyan-400" : ""}>{value > 0 ? `+${value}` : value}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative">
        <motion.div 
          className="absolute h-full bg-cyan-500"
          initial={{ width: "50%" }}
          animate={{ width: `${((value - min) / (max - min)) * 100}%` }}
          transition={{ type: "spring", stiffness: 25, damping: 20, mass: 1.5 }}
        />
      </div>
    </div>
  );

  return (
  <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans relative flex flex-col justify-center py-12">
    {/* 1. Background stays constant for both views */}
    <ParticleField /> 

    <div className="relative z-10 w-full"> 
      {view === 'landing' ? (
        /* --- VIEW 1: LANDING PAGE --- */
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "circOut" }}
          className="max-w-4xl mx-auto text-center px-6"
        >
          <h1 className="text-5xl md:text-7xl font-medium uppercase tracking-[0.5em] text-cyan-400 mb-6">
            APERTURE LAB
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl tracking-wide mb-12 max-w-2xl mx-auto leading-relaxed">
            Next-generation AI analysis for photography. 
            Elevate your edits with precision metrics.
          </p>
          
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(0, 255, 255, 0.3)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('editor')}
            className="px-10 py-4 bg-transparent border border-cyan-400 text-cyan-400 uppercase tracking-[0.3em] text-sm hover:bg-cyan-400 hover:text-black transition-all duration-300 rounded-full"
          >
            Enter Studio
          </motion.button>
        </motion.div>
      ) : (
        /* --- VIEW 2: THE EDITOR (Everything you already built) --- */
        <>
          <header className="max-w-6xl mx-auto w-full mb-10 px-4 flex justify-start">
            <h1 
              onClick={() => setView('landing')} // Clicking logo now goes back home
              className="text-2xl font-medium uppercase tracking-[0.2em] text-cyan-400 cursor-pointer transition-opacity hover:opacity-70"
            >
              APERTURE LAB
            </h1>
          </header>

          <main className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <label className="group relative flex flex-col items-center justify-center w-full h-[500px] border border-white/10 bg-zinc-900/20 backdrop-blur-sm rounded-3xl transition-all cursor-pointer overflow-hidden shadow-2xl">
                {image ? (
                  <div className="relative w-full h-full">
                    <img src={image} className="w-full h-full object-cover" alt="Preview" />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.preventDefault();
                        handleReset();
                      }}
                      className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white p-2 rounded-full border border-white/20 hover:bg-red-500/80 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-10 h-10 text-zinc-700 mb-4" />
                    <p className="text-sm text-zinc-600">Drop your photo here</p>
                  </div>
                )}
                <input type="file" className="hidden" onChange={handleUpload} accept="image/*" />
                {loading && (
                  <motion.div 
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-cyan-500/10 backdrop-blur-sm"
                  />
                )}
              </label>
              
              <motion.button 
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateAdvice}
                disabled={loading}
                className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl"
              >
                {loading ? <Loader2 className="animate-spin" /> : "GENERATE EDIT ADVICE"}
              </motion.button>
            </div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                duration: 1.5, 
                ease: [0.16, 1, 0.3, 1], // Custom "cubic-bezier" for a professional feel
                delay: 0.2 // Waits a split second after the page loads
              }}
              className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-8">
                <Sliders className="w-4 h-4 text-cyan-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">AI Analysis</h2>
              </div>

              <div className="space-y-8 flex-1">
                <Slider label="Exposure" value={settings.exposure} min={-100} max={100} />
                <Slider label="Contrast" value={settings.contrast} min={-100} max={100} />
                <Slider label="Highlights" value={settings.highlights} min={-100} max={100} />
                <Slider label="Shadows" value={settings.shadows} min={-100} max={100} />
                <Slider label="Vibrance" value={settings.vibrance} min={-100} max={100} />
              </div>

              <motion.div 
                key={advice}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 p-4 bg-black/40 backdrop-blur-md rounded-xl border border-white/5"
              >
                 <p className="text-xs text-zinc-400 leading-relaxed italic">
                   {advice || "Upload a photo and click generate to see the AI breakdown."}
                 </p>
              </motion.div>
            </motion.div>
          </main>
        </>
      )}
    </div>
        {/* --- SUBTLE FOOTER --- */}
    <footer className="absolute bottom-6 w-full text-center pointer-events-none">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500/50 font-medium">
        Developed by <span className="text-zinc-400">Kavin Rajesh</span>
      </p>
    </footer>
  </div>
);
}

export default App;