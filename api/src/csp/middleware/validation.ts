import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'VALIDATION_FAILED',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }
      res.status(500).json({ error: 'INTERNAL_VALIDATION_ERROR' });
    }
  };
};
