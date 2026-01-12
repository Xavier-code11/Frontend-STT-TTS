import './App.css'
import VoiceChatWidget from './components/VoiceChatWidget'

function App() {
  return (
    <div className="app-container">
      <div className="app-header">
        <h1 className="app-title">SerenityRev</h1>
        <p className="app-subtitle">AI Voice Assistant</p>
      </div>
      <main className="app-main">
        <VoiceChatWidget />
      </main>
      <footer className="app-footer">
        <p>Powered by AI • Real-time Voice Processing</p>
      </footer>
    </div>
  )
}

export default App
