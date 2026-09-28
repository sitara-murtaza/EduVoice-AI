# Testing EduVoice AI

## Automated checks

```bash
pnpm exec tsc --noEmit
node --experimental-strip-types --test tests/content.test.mjs
pnpm build
```

## Core interface

1. Open the landing page at desktop and mobile widths.
2. Confirm no Sign in, Create account, Demo Mode, Exam Mode, parent, or teacher options are displayed.
3. Select **Get started**, complete onboarding, and confirm the dashboard opens.
4. Reload the browser and confirm the profile and progress remain available on that device.
5. Confirm the twinkling-stars cursor effect matches the purple theme and respects reduced-motion/touch behavior.

## Voice Tutor

1. Open `/tutor` and confirm **Any Topic** is the default.
2. Leave Topic empty and start a live voice session.
3. Ask: `Teach me Python functions in beginner-level Urdu-English.`
4. Confirm the transcript reflects the latest question and the response is relevant.
5. Ask: `Give me a coding example.` Confirm the tutor retains the Python-functions context.
6. Change to Quiz Mode and ask: `Now take my quiz.` Confirm it continues the same topic.
7. Start a new session and verify old temporary messages are cleared.
8. Deny microphone permission and confirm the live text connection remains available.
9. Confirm provider or network failures show a clear error and never return a hardcoded sample response.

## Topic coverage

Test these questions separately:

- `Explain photosynthesis in simple English.`
- `Mujhe fractions samjhao.`
- `What is machine learning?`
- `Explain the causes of World War Two.`
- `Take a quiz about the solar system.`

Confirm the topic label changes appropriately or shows **General Learning** when uncertain.

## Resume Analyzer

1. Upload a text-based PDF smaller than 5 MB.
2. Confirm its selectable text appears in the resume field.
3. Enter a target role and run analysis.
4. Confirm an invalid or scanned image-only PDF displays a useful error.
5. Confirm provider failures do not silently generate a local demo analysis.

## AI Interviewer and progress

1. Start an interview with a chosen topic, language, difficulty, and question count.
2. Confirm questions adapt to the learner's latest response.
3. Finish a session and verify dashboard time and recent topics update once.
4. Confirm recent questions, recommendations, weak areas, and mistake review use saved activity.

Live microphone behavior and provider responses require valid credentials and must be tested in a real browser. A successful build alone does not prove external services are available.
