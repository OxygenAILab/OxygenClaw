import { Router, Request } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const PROXY_TIMEOUT = 30000;

interface ProxyRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function buildHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'host' || lowerKey === 'content-length' || lowerKey === 'connection') {
      continue;
    }
    result[key] = value;
  }
  
  return result;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '0.0.0.0' || host === '127.0.0.1' || host === '::1') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d+)\./);
  if (private172) {
    const second = Number(private172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  return false;
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

router.post('/request', authMiddleware, async (req: Request, res) => {
  try {
    const { url, method = 'GET', headers, body }: ProxyRequest = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL. Only http and https protocols are allowed.'
      });
    }

    const upperMethod = (method || 'GET').toUpperCase();
    if (!ALLOWED_METHODS.includes(upperMethod)) {
      return res.status(400).json({
        success: false,
        error: `Method not allowed. Allowed methods: ${ALLOWED_METHODS.join(', ')}`
      });
    }

    const fetchOptions: RequestInit = {
      method: upperMethod,
      headers: buildHeaders(headers),
    };

    if (body && upperMethod !== 'GET' && upperMethod !== 'HEAD') {
      fetchOptions.body = body;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT);
    fetchOptions.signal = controller.signal;

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'content-encoding' || lowerKey === 'transfer-encoding' || lowerKey === 'connection') {
        return;
      }
      responseHeaders[key] = value;
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    let responseBody: any = responseText;
    if (contentType.includes('application/json')) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }

    res.json({
      success: true,
      data: {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody
      }
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'Request timeout after 30 seconds'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Proxy request failed'
    });
  }
});

export default router;
