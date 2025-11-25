import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Configure LLM modal trigger (global)
window.addEventListener('llm:configure', async () => {
  const { openaiConfig } = await import('bootstrap-llm-provider');
  try {
    await openaiConfig({ show: true, defaultBaseUrls: ['https://llmfoundry.straive.com/openai/v1','https://llmfoundry.straivedemo.com/openai/v1'] });
  } catch (e) {
    // user cancelled
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)



