describe.only('Example', () => {
  it('should integrate as expected', async () => {
    await require('../example').run();
  });
});