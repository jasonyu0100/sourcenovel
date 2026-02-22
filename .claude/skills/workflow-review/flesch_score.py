#!/usr/bin/env python3
"""
Flesch Reading Ease Score Calculator for Chapter Drafts

Usage:
    python flesch_score.py <chapter_number>
    python flesch_score.py <path_to_markdown_file>

Flesch Reading Ease Score Interpretation:
    90-100: Very Easy (5th grade)
    80-89:  Easy (6th grade)
    70-79:  Fairly Easy (7th grade)
    60-69:  Standard (8th-9th grade)
    50-59:  Fairly Difficult (10th-12th grade)
    30-49:  Difficult (College level)
    0-29:   Very Difficult (College graduate level)

For fantasy/cultivation fiction, a score of 50-70 is typical and appropriate.

Dependencies:
    pip install textstat
"""

import sys
import re
from pathlib import Path

import textstat


def extract_text_from_markdown(content: str) -> str:
    """
    Extract plain text from markdown, removing formatting.
    """
    # Remove code blocks
    content = re.sub(r'```[\s\S]*?```', '', content)
    content = re.sub(r'`[^`]+`', '', content)

    # Remove headers (keep content)
    content = re.sub(r'^#{1,6}\s+', '', content, flags=re.MULTILINE)

    # Remove horizontal rules
    content = re.sub(r'^\*{3,}$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^-{3,}$', '', content, flags=re.MULTILINE)

    # Remove emphasis markers but keep text
    content = re.sub(r'\*\*([^*]+)\*\*', r'\1', content)
    content = re.sub(r'\*([^*]+)\*', r'\1', content)
    content = re.sub(r'__([^_]+)__', r'\1', content)
    content = re.sub(r'_([^_]+)_', r'\1', content)

    # Remove links but keep text
    content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', content)

    # Remove images
    content = re.sub(r'!\[([^\]]*)\]\([^)]+\)', '', content)

    return content.strip()


def calculate_flesch_score(text: str) -> dict:
    """
    Calculate Flesch Reading Ease score and related metrics using textstat.
    """
    word_count = textstat.lexicon_count(text, removepunct=True)
    sentence_count = textstat.sentence_count(text)
    syllable_count = textstat.syllable_count(text)

    if word_count == 0:
        return {
            'score': 0,
            'word_count': 0,
            'sentence_count': 0,
            'syllable_count': 0,
            'avg_words_per_sentence': 0,
            'avg_syllables_per_word': 0,
            'grade_level': 'N/A',
            'difficulty': 'N/A'
        }

    score = textstat.flesch_reading_ease(text)
    avg_words_per_sentence = word_count / sentence_count
    avg_syllables_per_word = syllable_count / word_count

    # Clamp score to 0-100 range
    score = max(0, min(100, score))

    # Determine difficulty level
    if score >= 90:
        difficulty = 'Very Easy'
        grade_level = '5th grade'
    elif score >= 80:
        difficulty = 'Easy'
        grade_level = '6th grade'
    elif score >= 70:
        difficulty = 'Fairly Easy'
        grade_level = '7th grade'
    elif score >= 60:
        difficulty = 'Standard'
        grade_level = '8th-9th grade'
    elif score >= 50:
        difficulty = 'Fairly Difficult'
        grade_level = '10th-12th grade'
    elif score >= 30:
        difficulty = 'Difficult'
        grade_level = 'College level'
    else:
        difficulty = 'Very Difficult'
        grade_level = 'College graduate'

    return {
        'score': round(score, 1),
        'word_count': word_count,
        'sentence_count': sentence_count,
        'syllable_count': syllable_count,
        'avg_words_per_sentence': round(avg_words_per_sentence, 1),
        'avg_syllables_per_word': round(avg_syllables_per_word, 2),
        'grade_level': grade_level,
        'difficulty': difficulty
    }


def get_verdict(score: float) -> str:
    """
    Get a verdict for the readability score in context of fantasy fiction.

    For cultivation/fantasy fiction:
    - 50-70: OPTIMAL - Complex enough for genre, accessible to readers
    - 40-49: ACCEPTABLE - Dense but appropriate for serious fantasy
    - 70-80: ACCESSIBLE - Easy reading, good for action scenes
    - Below 40: DENSE - May need simplification
    - Above 80: SIMPLE - May lack genre depth
    """
    if 50 <= score <= 70:
        return 'OPTIMAL'
    elif 40 <= score < 50:
        return 'ACCEPTABLE (dense)'
    elif 70 < score <= 80:
        return 'ACCESSIBLE'
    elif score < 40:
        return 'DENSE - consider simplifying'
    else:
        return 'SIMPLE - may lack depth'


def analyze_chapter(file_path: Path) -> dict:
    """
    Analyze a chapter file and return readability metrics.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    content = file_path.read_text(encoding='utf-8')
    text = extract_text_from_markdown(content)
    metrics = calculate_flesch_score(text)
    metrics['verdict'] = get_verdict(metrics['score'])
    metrics['file'] = str(file_path)

    return metrics


def format_report(metrics: dict) -> str:
    """
    Format metrics as a readable report.
    """
    return f"""
Flesch Reading Ease Analysis
{'=' * 40}

File: {metrics['file']}

SCORE: {metrics['score']} ({metrics['difficulty']})
Grade Level: {metrics['grade_level']}
Verdict: {metrics['verdict']}

Statistics:
  Words: {metrics['word_count']:,}
  Sentences: {metrics['sentence_count']:,}
  Syllables: {metrics['syllable_count']:,}

  Avg words/sentence: {metrics['avg_words_per_sentence']}
  Avg syllables/word: {metrics['avg_syllables_per_word']}

{'=' * 40}
For fantasy/cultivation fiction:
  50-70: OPTIMAL (complex yet accessible)
  40-49: ACCEPTABLE (dense but appropriate)
  70-80: ACCESSIBLE (easy reading)
"""


def main():
    if len(sys.argv) < 2:
        print("Usage: python flesch_score.py <chapter_number|path_to_file>")
        print("\nExamples:")
        print("  python flesch_score.py 1")
        print("  python flesch_score.py chapters/1/draft.md")
        sys.exit(1)

    arg = sys.argv[1]

    # Determine file path
    if arg.isdigit():
        # Chapter number provided — find series directory dynamically
        chapter_num = int(arg)
        matches = list(Path("series").glob(f"*/chapters/{chapter_num}/draft.md"))
        if matches:
            file_path = matches[0]
        else:
            print(f"Error: No draft.md found for chapter {chapter_num} in series/")
            sys.exit(1)
    else:
        # Path provided
        file_path = Path(arg)

    try:
        metrics = analyze_chapter(file_path)
        print(format_report(metrics))

        # Exit with code based on verdict
        if metrics['verdict'] == 'OPTIMAL':
            sys.exit(0)
        elif 'ACCEPTABLE' in metrics['verdict'] or metrics['verdict'] == 'ACCESSIBLE':
            sys.exit(0)
        else:
            sys.exit(1)

    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error analyzing file: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
