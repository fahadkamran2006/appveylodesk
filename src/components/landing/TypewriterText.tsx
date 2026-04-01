import { useState, useEffect, useCallback } from "react";

const WORDS = ["Google Drive Link.", "Dropbox Link.", "Frame.io Link."];
const TYPING_SPEED = 80;
const DELETING_SPEED = 50;
const PAUSE_AFTER_TYPE = 2000;
const PAUSE_AFTER_DELETE = 400;

const TypewriterText = () => {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const tick = useCallback(() => {
    const currentWord = WORDS[wordIndex];

    if (!isDeleting) {
      // Typing
      const next = currentWord.slice(0, text.length + 1);
      setText(next);
      if (next === currentWord) {
        // Finished typing, pause then delete
        setTimeout(() => setIsDeleting(true), PAUSE_AFTER_TYPE);
        return;
      }
    } else {
      // Deleting
      const next = currentWord.slice(0, text.length - 1);
      setText(next);
      if (next === "") {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % WORDS.length);
        setTimeout(() => {}, PAUSE_AFTER_DELETE);
        return;
      }
    }
  }, [text, isDeleting, wordIndex]);

  useEffect(() => {
    const speed = isDeleting ? DELETING_SPEED : TYPING_SPEED;
    // If we just finished typing or deleting, the pause is handled in tick
    const currentWord = WORDS[wordIndex];
    if (!isDeleting && text === currentWord) return;
    
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [tick, text, isDeleting, wordIndex]);

  return (
    <span className="text-gradient inline-block min-w-[1ch]">
      {text}
      <span className="inline-block w-[3px] h-[0.85em] bg-primary ml-0.5 align-middle animate-blink" />
    </span>
  );
};

export default TypewriterText;
