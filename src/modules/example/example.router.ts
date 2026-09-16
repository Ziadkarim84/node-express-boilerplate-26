import { Router } from 'express';
import { ok } from '../../common/utils/response.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { getValidated, validate } from '../../common/middlewares/validate.js';
import {
  createExampleSchemas,
  getExampleSchemas,
  listExamplesSchemas,
} from './example.schemas.js';
import * as exampleService from './example.service.js';

// authorize → validate → service → respond. No business logic here; Express 5
// forwards rejected promises to the error handler, so no try/catch.
export const exampleRouter = Router();

exampleRouter.get(
  '/',
  authorize({ only: 'examples:read' }),
  validate(listExamplesSchemas),
  async (req, res) => {
    const { query } = getValidated<typeof listExamplesSchemas>(req);
    const examples = await exampleService.listExamples(
      query.limit,
      query.offset,
    );
    ok(res, examples);
  },
);

exampleRouter.get(
  '/:exampleId',
  authorize({ only: 'examples:read' }),
  validate(getExampleSchemas),
  async (req, res) => {
    const { params } = getValidated<typeof getExampleSchemas>(req);
    const example = await exampleService.getExampleById(params.exampleId);
    ok(res, example);
  },
);

exampleRouter.post(
  '/',
  authorize({ only: 'examples:create' }),
  validate(createExampleSchemas),
  async (req, res) => {
    const { body } = getValidated<typeof createExampleSchemas>(req);
    const example = await exampleService.createExample(body);
    ok(res, example, 201);
  },
);
