export interface VoiceProvider {
  speak(text: string): Promise<void>
  pause(): void
  resume(): void
  stop(): void
  replay(text: string): Promise<void>
}

export class VoiceService implements VoiceProvider {
  private readonly provider: VoiceProvider

  constructor(provider: VoiceProvider) {
    this.provider = provider
  }

  speak(text: string) {
    return this.provider.speak(text)
  }

  pause() {
    this.provider.pause()
  }

  resume() {
    this.provider.resume()
  }

  stop() {
    this.provider.stop()
  }

  replay(text: string) {
    return this.provider.replay(text)
  }
}
