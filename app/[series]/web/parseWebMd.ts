// Parser for web.md files - converts markdown tree structure to TreeNode objects

import { API_BASE } from "@/lib/constants";

export interface TreeNode {
  id: string;
  label: string;
  description: string;
  detail?: string;
  quote?: string;
  children?: TreeNode[];
}

export interface ChapterMeta {
  title: string;
  subtitle: string;
}

export interface ParsedChapter {
  meta: ChapterMeta;
  tree: TreeNode;
}

interface ParsedBlock {
  level: number;
  label: string;
  description: string;
  detail?: string;
  quote?: string;
}

/**
 * Parse web.md content into a chapter tree structure
 */
export function parseWebMd(content: string, chapterNumber: number): ParsedChapter {
  const lines = content.split('\n');

  // Parse frontmatter
  const meta: ChapterMeta = { title: '', subtitle: '' };
  let i = 0;

  if (lines[0]?.trim() === '---') {
    i = 1;
    while (i < lines.length && lines[i]?.trim() !== '---') {
      const line = lines[i].trim();
      if (line.startsWith('title:')) {
        meta.title = line.slice(6).trim();
      } else if (line.startsWith('subtitle:')) {
        meta.subtitle = line.slice(9).trim();
      }
      i++;
    }
    i++; // Skip closing ---
  }

  // Parse content blocks
  const blocks: ParsedBlock[] = [];
  let currentBlock: ParsedBlock | null = null;
  let collectingDetail = false;

  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Header - starts a new block
    const headerMatch = trimmed.match(/^(#{1,5})\s+(.+)$/);
    if (headerMatch) {
      // Save previous block
      if (currentBlock) {
        blocks.push(currentBlock);
      }

      currentBlock = {
        level: headerMatch[1].length,
        label: headerMatch[2],
        description: '',
      };
      collectingDetail = false;
      continue;
    }

    if (!currentBlock) continue;

    // Empty line - just skip, don't change state
    if (!trimmed) {
      collectingDetail = false;
      continue;
    }

    // Blockquote (detail)
    if (trimmed.startsWith('>')) {
      const detailText = trimmed.slice(1).trim();
      if (currentBlock.detail) {
        currentBlock.detail += ' ' + detailText;
      } else {
        currentBlock.detail = detailText;
      }
      collectingDetail = true;
      continue;
    }

    // Quoted text (quote) - text surrounded by double quotes
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      currentBlock.quote = trimmed.slice(1, -1);
      collectingDetail = false;
      continue;
    }

    // Regular paragraph - add to description if no description yet, otherwise continue collecting detail
    if (!currentBlock.description) {
      currentBlock.description = trimmed;
    } else if (collectingDetail && currentBlock.detail) {
      currentBlock.detail += ' ' + trimmed;
    } else if (!currentBlock.detail && !currentBlock.quote) {
      // Continue adding to description if we haven't hit detail/quote yet
      currentBlock.description += ' ' + trimmed;
    }
  }

  // Don't forget the last block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Build tree from flat blocks
  const tree = buildTree(blocks, chapterNumber);

  return { meta, tree };
}

/**
 * Build a tree structure from flat parsed blocks
 */
function buildTree(blocks: ParsedBlock[], chapterNumber: number): TreeNode {
  if (blocks.length === 0) {
    return {
      id: `ch${chapterNumber}-root`,
      label: `Chapter ${chapterNumber}`,
      description: 'No content available',
    };
  }

  // Create nodes with IDs
  const nodes: (TreeNode & { level: number })[] = blocks.map((block, idx) => ({
    id: `ch${chapterNumber}-${idx}`,
    label: block.label,
    description: block.description || block.label,
    detail: block.detail,
    quote: block.quote,
    level: block.level,
    children: [],
  }));

  // Build tree by finding parent for each node
  const root = nodes[0];
  const stack: (TreeNode & { level: number })[] = [root];

  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];

    // Pop stack until we find a parent (lower level)
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    // Add as child of current stack top
    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    }

    // Push this node onto stack
    stack.push(node);
  }

  // Clean up: remove level property and empty children arrays
  const cleanNode = (node: TreeNode & { level?: number }): TreeNode => {
    const { level, ...rest } = node;
    const cleaned: TreeNode = { ...rest };
    if (cleaned.children && cleaned.children.length > 0) {
      cleaned.children = cleaned.children.map(cleanNode);
    } else {
      delete cleaned.children;
    }
    return cleaned;
  };

  return cleanNode(root);
}

/**
 * Fetch and parse a web.md file for a chapter
 */
export async function fetchChapterTree(
  seriesId: string,
  chapterNumber: number
): Promise<ParsedChapter | null> {
  try {
    const response = await fetch(`${API_BASE}/${seriesId}/chapters/${chapterNumber}/web.md`);
    if (!response.ok) return null;

    const content = await response.text();
    return parseWebMd(content, chapterNumber);
  } catch {
    return null;
  }
}
