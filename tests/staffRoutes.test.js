describe('route modules', () => {
  it('should load staff routes without throwing reference errors', () => {
    expect(() => require('../src/routes/staffRoutes')).not.toThrow();
  });

  it('should load blind date routes without throwing reference errors', () => {
    expect(() => require('../src/routes/blindDateRoutes')).not.toThrow();
  });
});
