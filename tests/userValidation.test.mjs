import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUser } from '../src/utils/userValidation.ts';

const valid = { firstName: 'Maria', username: 'maria', email: 'maria@example.com', password: 'senha-local', userRole: 'ADMIN' };

test('aceita ADMIN e SELLER, sobrenome opcional e limites do DTO', () => {
  for (const userRole of ['ADMIN', 'SELLER']) {
    assert.equal(validateUser({ ...valid, userRole }, valid.password), '');
    assert.equal(validateUser({ ...valid, userRole, firstName: 'a'.repeat(20), lastName: 'ab', username: 'a'.repeat(30) }, valid.password), '');
  }
});

test('rejeita campos inválidos e confirmação divergente', () => {
  for (const invalid of [{ firstName: 'a' }, { firstName: 'a'.repeat(21) }, { lastName: 'a' }, { lastName: 'a'.repeat(21) }, { username: 'a' }, { username: 'a'.repeat(31) }, { email: '' }, { email: 'invalido' }, { email: `${'a'.repeat(95)}@ex.com` }, { password: '12345' }, { password: '      ' }, { userRole: undefined }, { userRole: 'OTHER' }]) {
    assert.notEqual(validateUser({ ...valid, ...invalid }, valid.password), '', JSON.stringify(Object.keys(invalid)));
  }
  assert.match(validateUser(valid, 'outra-senha'), /confirmação/);
});

test('edição permite manter senha, mas valida nova senha', () => {
  assert.equal(validateUser({ ...valid, password: '' }, '', true), '');
  assert.match(validateUser({ ...valid, password: '123' }, '', true), /Senha/);
});
