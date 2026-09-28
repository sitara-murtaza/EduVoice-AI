class VoiceCapture extends AudioWorkletProcessor {
  constructor(){super();this.samples=[];this.position=0;this.batch=[];}
  process(inputs){const input=inputs[0]?.[0];if(!input)return true;this.samples.push(...input);const ratio=sampleRate/24000;while(this.position+1<this.samples.length){const i=Math.floor(this.position),f=this.position-i;const v=this.samples[i]*(1-f)+this.samples[i+1]*f;this.batch.push(Math.max(-32768,Math.min(32767,Math.round(v*32767))));this.position+=ratio;if(this.batch.length===1200){const pcm=new Int16Array(this.batch);this.port.postMessage(pcm.buffer,[pcm.buffer]);this.batch=[];}}const consumed=Math.floor(this.position);this.samples.splice(0,consumed);this.position-=consumed;return true;}
}
registerProcessor('voice-capture',VoiceCapture);
