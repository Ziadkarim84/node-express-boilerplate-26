import { AppError } from '../../common/errors/app-error.js';
import { toAmount } from '../../common/utils/money.js';
import { Example } from '../../db/index.js';
import type { CreateExampleInput } from './example.schemas.js';

// Business logic and DB access live here. Throw AppError for expected
// failures; routers stay thin.

export async function listExamples(
  limit: number,
  offset: number,
): Promise<Example[]> {
  return Example.findAll({
    limit,
    offset,
    order: [['id', 'DESC']],
  });
}

export async function getExampleById(exampleId: number): Promise<Example> {
  const example = await Example.findByPk(exampleId);
  if (!example) {
    throw AppError.notFound(`Example ${exampleId} not found`);
  }
  return example;
}

export async function createExample(
  input: CreateExampleInput,
): Promise<Example> {
  const existing = await Example.findOne({ where: { code: input.code } });
  if (existing) {
    throw AppError.conflict(`Code ${input.code} already exists`);
  }

  return Example.create({
    name: input.name,
    code: input.code,
    price: toAmount(input.price),
  });
}
