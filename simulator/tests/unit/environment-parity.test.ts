import {it,expect} from 'vitest';
import cases from '../../../docs/reference-fixtures/environment-parity.json';
import {tomatoRisk} from '../../src/domain/environment';
it('matches the unchanged Python tomato risk score and band across 256 boundary inputs',()=>{for(const c of cases){const [label,confidence,temp,rh,age]=c.input;const risk=tomatoRisk(label as 'Fresh'|'Rotten',Number(confidence),Number(temp),Number(rh),Number(age));expect(risk.score).toBe(c.score);expect(risk.level).toBe(c.level);}});
