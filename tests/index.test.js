const request = require('supertest');
const app = require('./app');

describe('POST /items', () => {
  it('should create a new item', async () => {
    const res = await request(app).post('/items').send({ name: 'test', value: 10 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('test');
    expect(res.body.value).toBe(10);
  });
  it('should return 400 for invalid input', async () => {
    const res = await request(app).post('/items').send({ name: 123, value: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid input: "name" must be a string and "value" must be a number');
  });
});

describe('GET /items', () => {
  it('should return all items', async () => {
    await request(app).post('/items').send({ name: 'test1', value: 1 });
    await request(app).post('/items').send({ name: 'test2', value: 2 });
    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

describe('GET /items/:id', () => {
  it('should return an item by ID', async () => {
    const postRes = await request(app).post('/items').send({ name: 'test', value: 10 });
    const id = postRes.body.id;
    const res = await request(app).get(`/items/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });
  it('should return 404 if item not found', async () => {
    const res = await request(app).get('/items/999');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Item not found');
  });
  it('should return 400 for invalid ID', async () => {
    const res = await request(app).get('/items/abc');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid ID format');
  });
});

describe('PUT /items/:id', () => {
  it('should update an item', async () => {
    const postRes = await request(app).post('/items').send({ name: 'test', value: 10 });
    const id = postRes.body.id;
    const res = await request(app).put(`/items/${id}`).send({ name: 'updated', value: 20 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('updated');
    expect(res.body.value).toBe(20);
  });
  it('should return 404 if item not found', async () => {
    const res = await request(app).put('/items/999').send({ name: 'test', value: 10 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Item not found');
  });
  it('should return 400 for invalid input', async () => {
    const postRes = await request(app).post('/items').send({ name: 'test', value: 10 });
    const id = postRes.body.id;
    const res = await request(app).put(`/items/${id}`).send({ name: 123, value: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid input: "name" must be a string and "value" must be a number');
  });
});

describe('DELETE /items/:id', () => {
  it('should delete an item', async () => {
    const postRes = await request(app).post('/items').send({ name: 'test', value: 10 });
    const id = postRes.body.id;
    const res = await request(app).delete(`/items/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });
  it('should return 404 if item not found', async () => {
    const res = await request(app).delete('/items/999');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Item not found');
  });
  it('should return 400 for invalid ID', async () => {
    const res = await request(app).delete('/items/abc');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid ID format');
  });
});