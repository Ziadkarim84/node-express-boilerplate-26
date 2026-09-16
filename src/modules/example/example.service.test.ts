import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';

vi.mock('../../db/index.js', () => ({
  Example: {
    findAll: vi.fn(),
    findByPk: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

const { Example } = await import('../../db/index.js');
const exampleService = await import('./example.service.js');

const mockExample = {
  id: 1,
  name: 'Sample thing',
  code: 'SAMPLE-1',
  price: 4.5,
};

describe('example.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getExampleById', () => {
    it('returns the example when found', async () => {
      vi.mocked(Example.findByPk).mockResolvedValue(mockExample as never);

      const example = await exampleService.getExampleById(1);

      expect(example).toEqual(mockExample);
      expect(Example.findByPk).toHaveBeenCalledWith(1);
    });

    it('throws 404 AppError when not found', async () => {
      vi.mocked(Example.findByPk).mockResolvedValue(null);

      await expect(exampleService.getExampleById(999)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('createExample', () => {
    it('creates an example when the code is unused', async () => {
      vi.mocked(Example.findOne).mockResolvedValue(null);
      vi.mocked(Example.create).mockResolvedValue(mockExample as never);

      const example = await exampleService.createExample({
        name: 'Sample thing',
        code: 'SAMPLE-1',
        price: 4.5,
      });

      expect(example).toEqual(mockExample);
      expect(Example.create).toHaveBeenCalledWith({
        name: 'Sample thing',
        code: 'SAMPLE-1',
        price: '4.50',
      });
    });

    it('throws 409 AppError when the code is taken', async () => {
      vi.mocked(Example.findOne).mockResolvedValue(mockExample as never);

      await expect(
        exampleService.createExample({
          name: 'Duplicate',
          code: 'SAMPLE-1',
          price: 1,
        }),
      ).rejects.toBeInstanceOf(AppError);
      expect(Example.create).not.toHaveBeenCalled();
    });
  });
});
