import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalBaseUrl} from '../src/models.js';

test('model endpoints must be loopback plain HTTP',()=>{
  assert.equal(assertLocalBaseUrl('http://127.0.0.1:11434').hostname,'127.0.0.1');
  assert.equal(assertLocalBaseUrl('http://localhost:8000').hostname,'localhost');
  assert.throws(()=>assertLocalBaseUrl('https://localhost:8000'),/loopback/);
  assert.throws(()=>assertLocalBaseUrl('http://192.168.1.4:11434'),/loopback/);
  assert.throws(()=>assertLocalBaseUrl('https://example.com'),/loopback/);
});

test('credentials are rejected without exposing them',()=>{assert.throws(()=>assertLocalBaseUrl('http://secret:password@localhost:8000'),(e:unknown)=>e instanceof Error&&!e.message.includes('secret')&&!e.message.includes('password'));assert.equal(assertLocalBaseUrl('http://[::1]:8000').hostname,'[::1]');});
