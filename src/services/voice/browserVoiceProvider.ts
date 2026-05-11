import type { VoiceProvider } from './voiceService'

function getPreferredVoice() {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find(v => v.name.toLowerCase().includes('natural') && v.lang.startsWith('en')) ??
    voices.find(v => v.name.toLowerCase().includes('jenny') && v.lang.startsWith('en')) ??
    voices.find(v => v.name.toLowerCase().includes('aria') && v.lang.startsWith('en')) ??
    voices.find(v => v.lang.startsWith('en')) ??
    null
  )
}

export class BrowserVoiceProvider implements VoiceProvider {
  private lastText = ''

  speak(text: string): Promise<void> {
    const cleanText = text.trim()
    if (!cleanText) return Promise.resolve()
    if (!('speechSynthesis' in window)) {
      return Promise.reject(new Error('Speech synthesis is not supported in this browser'))
    }

    this.stop()
    this.lastText = cleanText

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(cleanText)
      const applyVoice = () => {
        const preferred = getPreferredVoice()
        if (preferred) utterance.voice = preferred
        utterance.rate = 0.95
        utterance.pitch = 1
        utterance.volume = 1
      }

      utterance.onend = () => resolve()
      utterance.onerror = event => reject(new Error(event.error || 'Speech synthesis failed'))

      if (window.speechSynthesis.getVoices().length > 0) {
        applyVoice()
        window.speechSynthesis.speak(utterance)
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          applyVoice()
          window.speechSynthesis.speak(utterance)
        }
      }
    })
  }

  pause() {
    if ('speechSynthesis' in window) window.speechSynthesis.pause()
  }

  resume() {
    if ('speechSynthesis' in window) window.speechSynthesis.resume()
  }

  stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  replay(text?: string): Promise<void> {
    return this.speak(text?.trim() || this.lastText)
  }
}

export function createBrowserVoiceProvider() {
  return new BrowserVoiceProvider()
}

