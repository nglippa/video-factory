import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalBaseUrl,selectQwenModel} from '../src/models.js';

test('model endpoints must be loopback plain HTTP',()=>{
  assert.equal(assertLocalBaseUrl('http://127.0.0.1:11434').hostname,'127.0.0.1');
  assert.equal(assertLocalBaseUrl('http://localhost:8000').hostname,'localhost');
  assert.throws(()=>assertLocalBaseUrl('https://localhost:8000'),/loopback/);
  assert.throws(()=>assertLocalBaseUrl('http://192.168.1.4:11434'),/loopback/);
  assert.throws(()=>assertLocalBaseUrl('https://example.com'),/loopback/);
});

test('credentials are rejected without exposing them',()=>{assert.throws(()=>assertLocalBaseUrl('http://secret:password@localhost:8000'),(e:unknown)=>e instanceof Error&&!e.message.includes('secret')&&!e.message.includes('password'));assert.equal(assertLocalBaseUrl('http://[::1]:8000').hostname,'[::1]');});


test('selects the smallest installed text Qwen within the unified-memory budget',()=>{
 const models=[{name:'qwen3-coder:30b',size:18_556_700_761},{name:'qwen3:14b-q8_0',size:15_895_155_363},{name:'qwen3:8b',size:5_000_000_000},{name:'gemma3:12b',size:5_000_000_000}];
 assert.equal(selectQwenModel(models).name,'qwen3:8b');assert.equal(selectQwenModel(models,'qwen3:14b-q8_0').name,'qwen3:14b-q8_0');
 assert.throws(()=>selectQwenModel(models,'qwen3:missing'),/not installed/);assert.throws(()=>selectQwenModel(models,'qwen3-coder:30b'),/budget/);assert.throws(()=>selectQwenModel(models.filter(m=>!m.name.startsWith('qwen'))),/No installed/);
});
