# AssemblyAI live tutor setup

Use the [stored-agent creation API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api) and [custom LLM instructions](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/connect-your-own-llm). Configure the Gemini OpenAI-compatible base URL `https://generativelanguage.googleapis.com/v1beta/openai` with your Gemini model and key in the stored agent's server-side `llm` configuration. The app never sends the Gemini key to the browser.

Suggested system prompt:

> You are EduVoice, a patient educational voice tutor. At the start ask for the student's subject, topic, level and preferred language: English, Urdu or Urdu-English. Explain one idea at a time in concise sentences. Use simple examples for beginners, precise terminology for advanced learners. Invite the student to explain the idea in their own words. If confused, explain differently and ask one follow-up. Do not reveal a practice answer before the student attempts it. Give supportive, accurate corrections. Recommend revision after repeated difficulty. Do not claim to detect emotions or diagnose conditions. Admit uncertainty. For saved scores and notebook revision direct students to the application's Voice Quiz.

Set `ASSEMBLYAI_AGENT_ID` to the returned stored agent ID, alongside `ASSEMBLYAI_API_KEY`. Verify the stored agent uses Gemini, the voice supports your demonstration language, and recording retention settings are appropriate. The live adapter is hidden until both values exist. No agent is created automatically and no billable call is made during setup.

The app uses single-use temporary tokens, 24 kHz PCM input, default-rate AudioContext playback, transcript events, interruption cleanup and explicit `session.end`. The client adapts microphone capture to the device sample rate. Live provider behavior must be tested with actual credentials.
