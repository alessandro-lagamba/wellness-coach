import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

export class AudioConverter {
  private static tempDir = path.join(__dirname, '../temp');

  static async ensureTempDir(): Promise<void> {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  static async convertWavToPcm(audioBase64: string): Promise<string> {
    try {
      await this.ensureTempDir();
      
      // ✅ Genera nomi file unici
      const timestamp = Date.now();
      const inputFile = path.join(this.tempDir, `input_${timestamp}.m4a`);
      const pcmFile = path.join(this.tempDir, `output_${timestamp}.pcm`);
      
      // ✅ Decodifica base64 e salva file audio
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      fs.writeFileSync(inputFile, audioBuffer);
      
      console.log(`[AudioConverter] 📁 Saved audio file: ${inputFile}`);
      
      // ✅ Converti M4A → PCM usando ffmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputFile)
          .outputOptions([
            '-f', 's16le',        // Formato PCM signed 16-bit little-endian
            '-ar', '16000',      // Sample rate 16kHz (richiesto da Gemini)
            '-ac', '1'           // Mono (1 canale)
          ])
          .output(pcmFile)
          .on('end', () => {
            console.log(`[AudioConverter] ✅ Converted to PCM: ${pcmFile}`);
            resolve();
          })
          .on('error', (err: any) => {
            console.error(`[AudioConverter] ❌ FFmpeg error:`, err);
            reject(err);
          })
          .run();
      });
      
      // ✅ Leggi PCM e converti in base64
      const pcmBuffer = fs.readFileSync(pcmFile);
      const pcmBase64 = pcmBuffer.toString('base64');
      
      // ✅ Cleanup file temporanei
      fs.unlinkSync(inputFile);
      fs.unlinkSync(pcmFile);
      
      console.log(`[AudioConverter] 🎵 PCM conversion complete, size: ${pcmBase64.length} chars`);
      
      return pcmBase64;
      
    } catch (error) {
      console.error('[AudioConverter] ❌ Conversion failed:', error);
      throw error;
    }
  }

  static async convertPcmToWav(pcmBase64: string): Promise<string> {
    try {
      const pcmBuffer = Buffer.from(pcmBase64, 'base64');
      const wavBuffer = this.pcmBufferToWav(pcmBuffer, 16000, 1, 16);
      const wavBase64 = wavBuffer.toString('base64');
      console.log(`[AudioConverter] 🎵 PCM in-memory conversion complete, size: ${wavBase64.length} chars`);
      return wavBase64;
    } catch (error) {
      console.error('[AudioConverter] ❌ PCM→WAV conversion failed:', error);
      throw error;
    }
  }

  private static pcmBufferToWav(pcmBuffer: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const wavHeader = Buffer.alloc(44);

    wavHeader.write('RIFF', 0); // ChunkID
    wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4); // ChunkSize
    wavHeader.write('WAVE', 8); // Format
    wavHeader.write('fmt ', 12); // Subchunk1ID
    wavHeader.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
    wavHeader.writeUInt16LE(1, 20); // AudioFormat (PCM)
    wavHeader.writeUInt16LE(numChannels, 22); // NumChannels
    wavHeader.writeUInt32LE(sampleRate, 24); // SampleRate
    wavHeader.writeUInt32LE(byteRate, 28); // ByteRate
    wavHeader.writeUInt16LE(blockAlign, 32); // BlockAlign
    wavHeader.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
    wavHeader.write('data', 36); // Subchunk2ID
    wavHeader.writeUInt32LE(pcmBuffer.length, 40); // Subchunk2Size

    return Buffer.concat([wavHeader, pcmBuffer]);
  }
}
