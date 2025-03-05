import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  12
);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { nanoid };

interface AlignmentMetadata {
    word_history: {
        word: string;
        begin_time: number;
        end_time: number;
        original_word: string | null;
    }[];
}

export function generateWordsFromAlignmentMetadata(metadata: AlignmentMetadata | null | undefined) {
    if (!metadata || !metadata.word_history) {
        return [];
    }

    return metadata.word_history.map(wordInfo => ({
        id: nanoid(), // 使用你现有的 nanoid 函数
        word: wordInfo.word,
        start_time: wordInfo.begin_time,
        end_time: wordInfo.end_time,
        original_word: wordInfo.original_word,
    }));
}
