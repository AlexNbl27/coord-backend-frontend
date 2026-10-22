export function normalCdf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * erf);
}

export function calculateConfidenceInterval(converted, exposed) {
  if (!exposed || exposed <= 0) {
    return [0, 0];
  }

  const p = converted / exposed;
  const z = 1.95996;
  const z2 = z * z;

  const denom = 1 + z2 / exposed;
  const center = (p + z2 / (2 * exposed)) / denom;
  const halfWidth = (z * Math.sqrt((p * (1 - p) + z2 / (4 * exposed)) / exposed)) / denom;

  const lower = Math.max(0, center - halfWidth);
  const upper = Math.min(1, center + halfWidth);

  return [parseFloat(lower.toFixed(4)), parseFloat(upper.toFixed(4))];
}

export function calculateSrm(exposedA, exposedB) {
  const total = exposedA + exposedB;
  if (total < 20) {
    return { hasMismatch: false, pValue: 1.0, chiSquare: 0 };
  }

  const expected = total / 2;
  const chiSquare = Math.pow(exposedA - expected, 2) / expected + Math.pow(exposedB - expected, 2) / expected;
  const pValue = 2 * (1 - normalCdf(Math.sqrt(chiSquare)));
  const hasMismatch = pValue < 0.001;

  return {
    hasMismatch,
    pValue: parseFloat(pValue.toFixed(6)),
    chiSquare: parseFloat(chiSquare.toFixed(4))
  };
}

export function calculateTwoProportionZTest(exposedA, convertedA, exposedB, convertedB) {
  if (!exposedA || !exposedB || exposedA < 5 || exposedB < 5) {
    return {
      zScore: 0,
      pValue: 1.0,
      isSignificant: false,
      relativeLift: 0
    };
  }

  const pA = convertedA / exposedA;
  const pB = convertedB / exposedB;

  const pooledP = (convertedA + convertedB) / (exposedA + exposedB);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / exposedA + 1 / exposedB));

  if (se === 0) {
    return {
      zScore: 0,
      pValue: 1.0,
      isSignificant: false,
      relativeLift: 0
    };
  }

  const zScore = (pB - pA) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));
  const isSignificant = pValue < 0.05;
  const relativeLift = pA > 0 ? ((pB - pA) / pA) * 100 : 0;

  return {
    zScore: parseFloat(zScore.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(5)),
    isSignificant,
    relativeLift: parseFloat(relativeLift.toFixed(2))
  };
}
