import React, { useState } from 'react';
import { Download, LayoutTemplate, Settings, Link as LinkIcon, Building2, Sparkles, Plus, Trash2, Play, Eye, Code2, Monitor, Smartphone } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { layoutTemplate, generatePageTemplate } from './templates';

type GeneratedFile = {
  name: string;
  content: string;
  type: 'html' | 'js';
};

export default function App() {
  const [pages, setPages] = useState([
    { id: 'page1', title: 'Página Principal', checkoutUrl: '' },
    { id: 'page2', title: 'Página 2', checkoutUrl: '' }
  ]);

  const [formData, setFormData] = useState({
    productName: '',
    productDescription: '',
    language: 'pt',
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    companyName: '',
    companyEmail: '',
    companyAddress: '',
    companyCEP: '',
    companyId: '',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');

  // Preview States
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[] | null>(null);
  const [previewMode, setPreviewMode] = useState<'preview' | 'code'>('preview');
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<string>('index.html');
  const [isMobilePreview, setIsMobilePreview] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'geminiKey') {
      localStorage.setItem('gemini_api_key', value);
    }
  };

  const handlePageUrlChange = (id: string, url: string) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, checkoutUrl: url } : p));
  };

  const addPage = () => {
    const nextNum = pages.length + 1;
    setPages(prev => [...prev, { id: `page${nextNum}`, title: `Página ${nextNum}`, checkoutUrl: '' }]);
  };

  const removePage = (id: string) => {
    if (pages.length <= 1) return;
    setPages(prev => {
      const filtered = prev.filter(p => p.id !== id);
      // Reindex properties
      return filtered.map((p, idx) => ({
        ...p,
        id: `page${idx + 1}`,
        title: idx === 0 ? 'Página Principal' : (p.title.startsWith('Página') || p.title.startsWith('Upsell') ? `Página ${idx + 1}` : p.title)
      }));
    });
  };

  const handleExecute = async () => {
    setIsGenerating(true);
    setGenerationStatus('Analisando informações...');
    setGeneratedFiles(null);

    try {
      let aiData: any = null;

      if (formData.productName && formData.productDescription) {
        if (!formData.geminiKey) {
          alert('Para testar a IA, por favor insira a sua Chave da API do Gemini.');
          setIsGenerating(false);
          setGenerationStatus('');
          return;
        }

        setGenerationStatus('Gerando copy com IA (pode levar alguns segundos)...');

        const pagesMapText = pages.map((p, idx) => `- ${p.id}: ${idx === 0 ? 'A oferta principal' : `Oferta adicional/Upsell (Página ${idx + 1})`}`).join('\n');
        const exampleJson = pages.reduce((acc, p) => {
          acc[p.id] = { title: "...", subtitle: "...", benefits: ["...", "...", "..."], cta: "..." };
          return acc;
        }, {} as any);

        const prompt = `Atue como um Copywriter de Resposta Direta de Elite com foco em conversão e persuasão. Crie a copy para uma VSL (Text Sales Letter) de um funil de vendas baseado exatamente nos detalhes deste produto:
Nome do Produto: ${formData.productName}
Descrição: ${formData.productDescription}
Idioma: ${formData.language} (Gere todo o conteúdo no idioma solicitado).

O usuário definiu que o funil terá exatas ${pages.length} página(s). Mapeie o funil nas seguintes páginas:
${pagesMapText}

Para CADA página, retorne um objeto com estas propriedades obrigatórias:
"title": O título principal ultra chamativo e que prenda a pessoa na hora.
"subtitle": Um subtítulo persuasivo ou promessa secundária para embasar a compra.
"benefits": Um array com 3 itens (frase curta destacando benefício/alívio).
"cta": Texto persuasivo para o botão de compra.

Retorne APENAS um JSON válido estritão, sem formatação markdown, pronto para ser lido por JSON.parse().
Exemplo:
${JSON.stringify(exampleJson, null, 2)}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${formData.geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (!res.ok) {
          throw new Error('Erro na API do Gemini. Verifique se a chave é válida e tente novamente.');
        }

        const data = await res.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        aiData = JSON.parse(textResponse);
      }

      setGenerationStatus('Compilando páginas e recursos...');

      const files: GeneratedFile[] = [];

      // 1. Process layout.js
      let layoutJs = layoutTemplate;

      layoutJs += `\n// OVERRIDES DE IDIOMA E IA\ncurrentLang = '${formData.language}';\n`;

      if (aiData) {
        layoutJs += `
if (!translations['${formData.language}']) {
    translations['${formData.language}'] = { 
       langName: '${formData.language.toUpperCase()}', 
       footerDisclaimer: translations['en']?.footerDisclaimer || '', 
       footerNote: translations['en']?.footerNote || '', 
       legal: 'Legal', terms: 'Terms', privacy: 'Privacy', refund: 'Refund', warning: 'Warning', contact: 'Contact', companyInfo: 'Info', close: 'Close' 
    };
}
`;
        pages.forEach(p => {
          if (aiData[p.id]) {
            layoutJs += `translations['${formData.language}'].${p.id} = ${JSON.stringify(aiData[p.id])};\n`;
          }
        });

        layoutJs += `
const languageLabels = {
  pt: { terms: 'Termos de Uso', privacy: 'Política de Privacidade', refund: 'Política de Reembolso', warning: 'Aviso Legal' },
  en: { terms: 'Terms of Use', privacy: 'Privacy Policy', refund: 'Refund Policy', warning: 'Legal Warning' },
  es: { terms: 'Términos de Uso', privacy: 'Política de Privacidad', refund: 'Política de Reembolso', warning: 'Aviso Legal' },
  it: { terms: 'Termini di Utilizzo', privacy: 'Politica sulla Riservatezza', refund: 'Politica di Rimborso', warning: 'Avviso Legale' },
  de: { terms: 'Nutzungsbedingungen', privacy: 'Datenschutzrichtlinie', refund: 'Rückerstattungsrichtlinie', warning: 'Haftungsausschluss' },
  fr: { terms: "Conditions d'Utilisation", privacy: 'Politique de Confidentialité', refund: 'Politique de Remboursement', warning: 'Avertissement Légal' }
};

const labels = languageLabels['${formData.language}'] || languageLabels['en'];
legalTexts.terms.title = labels.terms;
legalTexts.privacy.title = labels.privacy;
legalTexts.refund.title = labels.refund;
legalTexts.warning.title = labels.warning;
`;
      }

      layoutJs = layoutJs.replace(/\{\{COMPANY_NAME\}\}/g, formData.companyName || 'Vanguard Group LTDA');
      layoutJs = layoutJs.replace(/\{\{COMPANY_EMAIL\}\}/g, formData.companyEmail || 'vanguardgroup.10m@gmail.com');
      layoutJs = layoutJs.replace(/\{\{COMPANY_ADDRESS\}\}/g, formData.companyAddress || 'Rua Jose Maria Resende, 728<br>Loja 4 Quadrasem Saida, Centro\nSão Sebastião da Vargem Alegre - MG');
      layoutJs = layoutJs.replace(/\{\{COMPANY_CEP\}\}/g, formData.companyCEP || '15400-726');
      layoutJs = layoutJs.replace(/\{\{COMPANY_ID\}\}/g, formData.companyId || 'CNPJ: 63.373.434/0001-57');
      layoutJs = layoutJs.replace(/\{\{CURRENT_DATE\}\}/g, new Date().toLocaleDateString(formData.language || 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      layoutJs = layoutJs.replace(/\{\{PRODUCT_NAME\}\}/g, formData.productName || 'Le protocole pink salt Burn');

      files.push({ name: 'layout.js', content: layoutJs, type: 'js' });

      // 2. Process HTML files based on pages array
      pages.forEach((p, idx) => {
        const fileName = idx === 0 ? 'index.html' : `${p.id}.html`;
        let rawHtml = generatePageTemplate(p.id, formData.language, idx, p.checkoutUrl);

        rawHtml = rawHtml.replace(/\{\{COMPANY_NAME\}\}/g, formData.companyName || 'Guilherme Augusto Bassi');
        rawHtml = rawHtml.replace(/\{\{COMPANY_EMAIL\}\}/g, formData.companyEmail || 'bassev7n@gmail.com');
        rawHtml = rawHtml.replace(/\{\{COMPANY_ADDRESS\}\}/g, formData.companyAddress || 'Rua Paulo Brancalião, 184, Jardim Helio Cazarine, Olímpia - SP');
        rawHtml = rawHtml.replace(/\{\{COMPANY_CEP\}\}/g, formData.companyCEP || '15400-726');
        rawHtml = rawHtml.replace(/\{\{COMPANY_ID\}\}/g, formData.companyId || 'CPF: 381.358.788-69');

        files.push({ name: fileName, content: rawHtml, type: 'html' });
      });

      setGeneratedFiles(files);
      setSelectedPreviewFile('index.html');
      setPreviewMode('preview');

      // Scroll smoothly to preview
      setTimeout(() => {
        document.getElementById('preview-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error: any) {
      console.error('Error generating funnel:', error);
      alert('Erro: ' + error.message);
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const handleDownloadZip = async () => {
    if (!generatedFiles) return;
    const zip = new JSZip();
    generatedFiles.forEach(f => zip.file(f.name, f.content));
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `funil-${(formData.productName || formData.companyName || 'saas').toLowerCase().replace(/\s+/g, '-')}.zip`);
  };

  const currentFileData = generatedFiles?.find(f => f.name === selectedPreviewFile);

  const getIframeSrcDoc = () => {
    if (!currentFileData || currentFileData.type !== 'html' || !generatedFiles) return '';
    const jsContent = generatedFiles.find(f => f.name === 'layout.js')?.content || '';
    // Inject the JS directly into a script block so the iframe can execute it
    return currentFileData.content.replace('<script src="layout.js"></script>', `<script>\n${jsContent}\n</script>`);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <LayoutTemplate className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Funil Maker Pro</h1>
              <p className="text-xs text-slate-500 font-medium">SaaS de Geração e Preview em Tempo Real</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {generationStatus && <span className="text-xs font-medium text-emerald-600 hidden md:block">{generationStatus}</span>}
            <button
              onClick={handleExecute}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-indigo-600/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              {isGenerating ? 'Executando...' : 'Executar Criação'}
            </button>

            {generatedFiles && (
              <button
                onClick={handleDownloadZip}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-emerald-600/10 transition-all"
              >
                <Download className="w-4 h-4" />
                Baixar Projeto (ZIP)
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Formulário Coluna Esquerda */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* AI Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-900">Configuração de IA</h2>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Idioma do Funil</label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="pt">Português (BR)</option>
                  <option value="en">Inglês (EN)</option>
                  <option value="es">Espanhol (ES)</option>
                  <option value="fr">Francês (FR)</option>
                  <option value="it">Italiano (IT)</option>
                  <option value="de">Alemão (DE)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">API Key (Gemini)</label>
                <input
                  type="password"
                  name="geminiKey"
                  value={formData.geminiKey}
                  onChange={handleInputChange}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Produto</label>
                <input
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleInputChange}
                  placeholder="Ex: Acelerador de Queima"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Descrição (O que faz?)</label>
                <textarea
                  name="productDescription"
                  value={formData.productDescription}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Ex: Método para reeducação focado..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>
            </div>
          </section>

          {/* Páginas Dinâmicas */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900">Páginas & Checkouts</h2>
              </div>
              <button
                onClick={addPage}
                className="flex items-center justify-center gap-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded text-xs font-semibold"
              >
                <Plus className="w-3 h-3" /> Nova Tela
              </button>
            </div>

            <div className="p-4 space-y-3 bg-slate-50/30">
              {pages.map((p, idx) => (
                <div key={p.id} className="relative bg-white border border-slate-200 p-3 rounded-lg flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      {p.title}
                      <span className="text-[10px] text-slate-400 font-normal italic">
                        ({idx === 0 ? 'index.html' : `${p.id}.html`})
                      </span>
                    </label>
                    {idx > 0 && (
                      <button
                        onClick={() => removePage(p.id)}
                        className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={p.checkoutUrl}
                    onChange={(e) => handlePageUrlChange(p.id, e.target.value)}
                    placeholder="Link do Checkout..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Compliance */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Compliance & Empresa</h2>
            </div>
            <div className="p-5 space-y-4">
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                placeholder="Empresa/Pessoa: Guilherme Augusto Bassi"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="text"
                name="companyId"
                value={formData.companyId}
                onChange={handleInputChange}
                placeholder="Documento/CNPJ"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="text"
                name="companyEmail"
                value={formData.companyEmail}
                onChange={handleInputChange}
                placeholder="E-mail de Suporte"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="text"
                name="companyAddress"
                value={formData.companyAddress}
                onChange={handleInputChange}
                placeholder="Endereço Físico"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
              />
              <input
                type="text"
                name="companyCEP"
                value={formData.companyCEP}
                onChange={handleInputChange}
                placeholder="CEP (Ex: 15400-726)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </section>
        </div>

        {/* Console / Preview Coluna Direita */}
        <div className="lg:col-span-8 flex flex-col h-full" id="preview-section">
          {generatedFiles ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[800px]">
              {/* Header do Previewer */}
              <div className="bg-slate-900 text-slate-300 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {generatedFiles.filter(f => f.type === 'html').map(f => (
                    <button
                      key={f.name}
                      onClick={() => {
                        setSelectedPreviewFile(f.name);
                        setPreviewMode('preview');
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${selectedPreviewFile === f.name ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
                    >
                      {f.name}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-slate-700 mx-1"></div>
                  <button
                    onClick={() => {
                      setSelectedPreviewFile('layout.js');
                      setPreviewMode('code');
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedPreviewFile === 'layout.js' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
                  >
                    layout.js
                  </button>
                </div>

                {/* View toggles */}
                <div className="flex items-center bg-slate-800 rounded-lg p-1 ml-4 shrink-0">
                  <button
                    onClick={() => setPreviewMode('preview')}
                    disabled={currentFileData?.type !== 'html'}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${previewMode === 'preview' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'} disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button
                    onClick={() => setPreviewMode('code')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${previewMode === 'code' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Code2 className="w-3.5 h-3.5" /> Code
                  </button>
                </div>
              </div>

              {/* Viewport de dispositivo virtual no Preview Mode */}
              {previewMode === 'preview' && currentFileData?.type === 'html' && (
                <div className="bg-slate-100 flex items-center justify-center p-2 border-b border-slate-200 shrink-0 gap-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Dispositivo:</span>
                  <div className="flex bg-white rounded-md shadow-sm border border-slate-200 p-0.5">
                    <button
                      onClick={() => setIsMobilePreview(false)}
                      className={`p-1.5 rounded ${!isMobilePreview ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Monitor className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsMobilePreview(true)}
                      className={`p-1.5 rounded ${isMobilePreview ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Content Area */}
              <div className="flex-1 bg-slate-50 overflow-hidden relative flex flex-col items-center">
                {previewMode === 'preview' ? (
                  currentFileData?.type === 'html' ? (
                    <div className={`transition-all duration-300 ease-in-out w-full h-full flex flex-col ${isMobilePreview ? 'max-w-[400px] border-x border-slate-300 shadow-2xl bg-white' : ''}`}>
                      <iframe
                        key={currentFileData.name}
                        title="Preview"
                        srcDoc={getIframeSrcDoc()}
                        className="w-full h-full flex-1 border-0 bg-white"
                        sandbox="allow-scripts allow-same-origin allow-popups"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                      O arquivo selecionado não suporta visualização renderizada.
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-[#1e1e1e] text-slate-300 p-6 overflow-auto">
                    <pre className="font-mono text-[13px] leading-relaxed">
                      <code>{currentFileData?.content}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-2xl p-10 text-white shadow-xl relative overflow-hidden h-full flex flex-col justify-center border border-slate-800">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                <Settings className="w-96 h-96" />
              </div>
              <div className="relative z-10 text-center max-w-lg mx-auto space-y-6">
                <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Play className="w-8 h-8 ml-1" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Pronto para Gerar?
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Preencha os dados do formulário ao lado e clique em <strong className="text-white">Executar Criação</strong>. O modelo Gemini 2.5 Flash vai gerar todas as páginas sob medida, e você poderá revisar o design e os textos em tempo real antes de salvar o projeto em ZIP.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
