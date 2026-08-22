/**
 * GUI Action Parser
 * Parses model output into structured GUI actions
 * Based on UI-TARS action parsing pattern
 */

import { GUIAction, GUIActionType, GUIActionInputs } from './types';

const GUI_ACTION_TYPES = new Set<string>([
  'click',
  'left_double',
  'right_single',
  'drag',
  'type',
  'hotkey',
  'scroll',
  'wait',
  'navigate',
  'navigate_back',
  'screenshot',
  'finished',
  'call_user',
]);

function isGUIActionType(type: string): type is GUIActionType {
  return GUI_ACTION_TYPES.has(type);
}

export function parseGUIAction(modelOutput: string): GUIAction | null {
  const actionMatch = modelOutput.match(/<action>\s*([\s\S]*?)\s*<\/action>/i);
  const actionStr = actionMatch ? actionMatch[1].trim() : modelOutput.trim();

  const thoughtMatch = modelOutput.match(/<thinking>\s*([\s\S]*?)\s*<\/thinking>/i);
  const thought = thoughtMatch ? thoughtMatch[1].trim() : undefined;

  const actionTypeMatch = actionStr.match(/^(\w+)\s*\(/);
  if (!actionTypeMatch) {
    return null;
  }

  const type = actionTypeMatch[1];
  if (!isGUIActionType(type)) {
    return null;
  }

  const inputs = parseActionInputs(actionStr);

  return {
    type,
    inputs,
    thought,
    rawAction: actionStr,
  };
}

function parseActionInputs(actionStr: string): GUIActionInputs {
  const inputs: GUIActionInputs = {};

  const paramsMatch = actionStr.match(/\((.*)\)/);
  if (!paramsMatch) return inputs;

  const paramsStr = paramsMatch[1];
  
  const startBoxMatch = paramsStr.match(/start_box\s*=\s*['"]([^'"]+)['"]/);
  if (startBoxMatch) {
    inputs.start_box = startBoxMatch[1];
    const coords = parseBox(startBoxMatch[1]);
    if (coords) {
      inputs.startX = coords.x;
      inputs.startY = coords.y;
    }
  }

  const endBoxMatch = paramsStr.match(/end_box\s*=\s*['"]([^'"]+)['"]/);
  if (endBoxMatch) {
    inputs.end_box = endBoxMatch[1];
    const coords = parseBox(endBoxMatch[1]);
    if (coords) {
      inputs.endX = coords.x;
      inputs.endY = coords.y;
    }
  }

  const contentMatch = paramsStr.match(/content\s*=\s*['"]([^'"]*)['"]/);
  if (contentMatch) {
    inputs.content = contentMatch[1];
  }

  const keyMatch = paramsStr.match(/key\s*=\s*['"]([^'"]+)['"]/);
  if (keyMatch) {
    inputs.key = keyMatch[1];
  }

  const directionMatch = paramsStr.match(/direction\s*=\s*['"]([^'"]+)['"]/);
  if (directionMatch) {
    inputs.direction = directionMatch[1] as 'up' | 'down' | 'left' | 'right';
  }

  const urlMatch = paramsStr.match(/url\s*=\s*['"]([^'"]+)['"]/);
  if (urlMatch) {
    inputs.url = urlMatch[1];
  }

  const startXMatch = paramsStr.match(/start_x\s*=\s*([\d.]+)/);
  if (startXMatch) {
    inputs.startX = parseFloat(startXMatch[1]);
  }

  const startYMatch = paramsStr.match(/start_y\s*=\s*([\d.]+)/);
  if (startYMatch) {
    inputs.startY = parseFloat(startYMatch[1]);
  }

  return inputs;
}

function parseBox(boxStr: string): { x: number; y: number } | null {
  const match = boxStr.match(/\[([\d.]+),\s*([\d.]+)/);
  if (match) {
    return {
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
    };
  }
  return null;
}

export function formatGUIAction(action: GUIAction): string {
  const parts: string[] = [];

  switch (action.type) {
    case 'click':
    case 'left_double':
    case 'right_single':
      if (action.inputs.start_box) {
        parts.push(`${action.type}(start_box='${action.inputs.start_box}')`);
      } else if (action.inputs.startX !== undefined && action.inputs.startY !== undefined) {
        parts.push(`${action.type}(start_box='[${action.inputs.startX.toFixed(4)}, ${action.inputs.startY.toFixed(4)}]')`);
      }
      break;
    case 'drag':
      if (action.inputs.start_box && action.inputs.end_box) {
        parts.push(`drag(start_box='${action.inputs.start_box}', end_box='${action.inputs.end_box}')`);
      }
      break;
    case 'type':
      parts.push(`type(content='${action.inputs.content || ''}')`);
      break;
    case 'hotkey':
      parts.push(`hotkey(key='${action.inputs.key || ''}')`);
      break;
    case 'scroll':
      if (action.inputs.start_box) {
        parts.push(`scroll(start_box='${action.inputs.start_box}', direction='${action.inputs.direction || 'down'}')`);
      }
      break;
    case 'navigate':
      parts.push(`navigate(url='${action.inputs.url || ''}')`);
      break;
    case 'wait':
    case 'screenshot':
    case 'finished':
    case 'call_user':
    case 'navigate_back':
      parts.push(`${action.type}()`);
      break;
    default:
      parts.push(`${action.type}()`);
  }

  return parts.join('\n');
}
