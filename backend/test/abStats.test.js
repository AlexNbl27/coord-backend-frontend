import assert from 'node:assert';
import {
  normalCdf,
  calculateConfidenceInterval,
  calculateSrm,
  calculateTwoProportionZTest
} from '../src/utils/abStats.js';

console.log('--- Test abStats ---');

// 1. Normal CDF
assert(Math.abs(normalCdf(0) - 0.5) < 1e-4, 'normalCdf(0) should be 0.5');
assert(Math.abs(normalCdf(1.96) - 0.975) < 1e-3, 'normalCdf(1.96) should be approx 0.975');
assert(Math.abs(normalCdf(-1.96) - 0.025) < 1e-3, 'normalCdf(-1.96) should be approx 0.025');
console.log('✓ normalCdf tests passed');

// 2. Confidence Interval (Wilson)
const [ciLow, ciHigh] = calculateConfidenceInterval(20, 100);
assert(ciLow > 0.12 && ciLow < 0.15, `ciLow should be around 0.13, got ${ciLow}`);
assert(ciHigh > 0.27 && ciHigh < 0.30, `ciHigh should be around 0.28, got ${ciHigh}`);
console.log('✓ calculateConfidenceInterval tests passed');

// 3. SRM Test (Sample Ratio Mismatch)
// Case A: balanced (50 vs 50)
const srmBalanced = calculateSrm(50, 50);
assert(!srmBalanced.hasMismatch, '50 vs 50 should not have mismatch');
assert(srmBalanced.pValue > 0.9, 'p-value should be near 1 for 50 vs 50');

// Case B: heavily skewed (100 vs 20)
const srmSkewed = calculateSrm(100, 20);
assert(srmSkewed.hasMismatch, '100 vs 20 should trigger SRM mismatch');
assert(srmSkewed.pValue < 0.001, 'p-value should be < 0.001 for 100 vs 20');
console.log('✓ calculateSrm tests passed');

// 4. Two-proportion Z-test
// Scenario: A: 100 exposed, 15 converted (15%) ; B: 100 exposed, 35 converted (35%)
const zTest = calculateTwoProportionZTest(100, 15, 100, 35);
assert(zTest.isSignificant === true, 'Difference between 15% and 35% with N=100 each should be statistically significant');
assert(zTest.pValue < 0.01, `p-value should be < 0.01, got ${zTest.pValue}`);
assert(zTest.relativeLift > 100, `relative lift should be +133%, got ${zTest.relativeLift}`);
console.log('✓ calculateTwoProportionZTest tests passed');

console.log('All abStats unit tests passed successfully!');

