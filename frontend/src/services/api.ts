import {
  AnalysisResponse,
  HealthResponse,
  ModelStatusResponse,
  ValidationResponse,
} from '../types/analysis';

import demoResponses from '../assets/demo_responses.json';
import validationFallback from '../assets/validation_fallback.json';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

async function handleResponse<T>(res: Response, endpointDesc: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Likely a Vite proxy connection error (ECONNREFUSED) which returns HTML/plain text 500
    throw new NetworkError('API server offline — connect to backend on port 8000.');
  }

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.message || data?.detail || `${endpointDesc} returned status ${res.status}`;
    throw new NetworkError(errorMsg);
  }
  return data as T;
}

export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return await handleResponse<HealthResponse>(res, 'Health check');
  } catch (err: any) {
    if (err instanceof NetworkError) throw err;
    return {
      status: 'ok',
      mode: 'demo',
      version: '1.0.0',
      ml_module_loaded: true,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getModelStatus(): Promise<ModelStatusResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/model/status`);
    return await handleResponse<ModelStatusResponse>(res, 'Model status');
  } catch (err: any) {
    if (err instanceof NetworkError) throw err;
    return {
      available: true,
      model_name: 'ResNet-18 (PneumoniaMNIST+)',
      model_version: 'resnet18-pneumoniamnist224-v1+2c4f0760',
      supported_image_type: 'Chest X-ray (educational, pediatric)',
      inference_ready: true,
      calibration_available: true,
      ood_available: true,
      quality_available: true,
      gradcam_available: true,
      mode: 'demo',
      message: 'Static Preview Mode (Educational Demo)',
    };
  }
}

export async function getValidation(): Promise<ValidationResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/validation`);
    return await handleResponse<ValidationResponse>(res, 'Validation report');
  } catch (err: any) {
    if (err instanceof NetworkError) throw err;
    return validationFallback as unknown as ValidationResponse;
  }
}

export async function predictImage(
  file: File,
  signal?: AbortSignal,
  demoScenario?: string
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (demoScenario) {
    headers['X-Demo-Scenario'] = demoScenario;
  }

  try {
    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      body: formData,
      headers,
      signal,
    });
    if (res.ok) {
      const data = await res.json();
      return data as AnalysisResponse;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
  }

  // Static host / GitHub Pages fallback: match based on file name or scenario
  const fileNameLower = file.name.toLowerCase();
  let key = demoScenario?.toLowerCase() || 'uncertain';
  if (fileNameLower.includes('normal')) key = 'normal';
  else if (fileNameLower.includes('pneumonia')) key = 'pneumonia';
  else if (fileNameLower.includes('blur')) key = 'poor_quality';
  else if (fileNameLower.includes('ood')) key = 'ood';
  else if (fileNameLower.includes('uncertain')) key = 'uncertain';

  const demoData = (demoResponses as any)[key] || (demoResponses as any)['uncertain'];
  if (demoData) {
    await new Promise((r) => setTimeout(r, 600));
    return demoData as AnalysisResponse;
  }

  throw new NetworkError('API server offline — failed to reach analysis endpoint on port 8000.');
}

export async function getFractureStatus(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/fracture/status`);
    return await handleResponse(res, 'Fracture model status');
  } catch (err: any) {
    if (err instanceof NetworkError && !err.message.includes('offline')) throw err;
    return {
      available: true,
      status: 'ready',
      model_name: 'ConvNeXt-Base Bone Fracture Model',
      backbone: 'convnext_base',
      device: 'cpu',
      supported_anatomies: ['Wrist', 'Hand', 'Leg', 'Foot', 'Arm', 'Hip'],
      message: 'Educational demo mode active',
    };
  }
}

export async function predictFracture(
  file: File,
  signal?: AbortSignal
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/api/fracture/predict`, {
      method: 'POST',
      body: formData,
      signal,
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
  }

  // Offline / GitHub Pages fallback
  const fileNameLower = file.name.toLowerCase();
  const isFracture = fileNameLower.includes('fracture');
  await new Promise((r) => setTimeout(r, 600));

  return {
    request_id: 'gh-pages-demo-' + Math.random().toString(36).slice(2, 9),
    available: true,
    status: 'success',
    model_name: 'ConvNeXt-Base Bone Fracture Model',
    model_version: 'convnext-base-v1',
    task: 'Bone Fracture Detection',
    finding: isFracture ? 'Fracture Detected' : 'No Fracture Detected',
    fracture_detected: isFracture,
    raw_probability: isFracture ? 0.942 : 0.058,
    calibrated_probability: isFracture ? 0.931 : 0.065,
    decision_threshold: 0.5,
    uncertainty: 'low',
    review_required: false,
    image_quality: {
      acceptable: true,
      width: 512,
      height: 512,
      mean_intensity: 128.4,
      std_intensity: 45.2,
      issues: [],
      status: 'Passed pre-inference quality checks',
    },
    supported_anatomy_status: 'Supported anatomical region',
    supported_anatomies: ['Wrist', 'Hand', 'Leg', 'Foot', 'Arm', 'Hip'],
    evidence: {
      gradcam_overlay_base64: null,
      disclaimer: 'Educational demonstration preview. Not for diagnostic use.',
    },
    model_limitations: 'Demonstration simulation running in static preview mode.',
    validation_reference: 'Internal benchmark validation on 3,449 bone radiographs',
  };
}

export async function getFractureValidation(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/fracture/validation`);
    return await handleResponse(res, 'Fracture validation report');
  } catch (err: any) {
    if (err instanceof NetworkError && !err.message.includes('offline')) throw err;
    return {
      model_name: 'ConvNeXt-Base Fracture Model',
      dataset: 'Bone Fracture Multi-Anatomy Benchmark',
      evaluated_on: '2026-10-08',
      metrics: {
        accuracy: 0.942,
        auroc: 0.978,
        sensitivity: 0.935,
        specificity: 0.948,
        precision: 0.947,
        recall: 0.935,
        f1: 0.941,
        ece: 0.038,
      },
      split_counts: {
        train: 17008,
        val: 3419,
        test: 3449,
      },
    };
  }
}

export async function getRegisteredModels(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/models`);
    return await handleResponse(res, 'Registered models list');
  } catch (err: any) {
    if (err instanceof NetworkError && !err.message.includes('offline')) throw err;
    return {
      models: [
        {
          id: 'resnet18_pneumonia',
          name: 'ResNet-18 Pneumonia Detector',
          version: '1.0.0',
          anatomy: 'Chest X-Ray',
          status: 'ready',
        },
        {
          id: 'convnext_fracture',
          name: 'ConvNeXt-Base Fracture Analysis',
          version: '1.0.0',
          anatomy: 'Bone / Musculoskeletal',
          status: 'ready',
        },
      ],
    };
  }
}
