import { Router } from 'express';
import { route } from '../http';
import { savePermit } from '../permits/savePermit';

export const permitsRouter = Router();

permitsRouter.post(
  '/permits',
  route('POST /permits', async (req, res) => {
    const permit = await savePermit(req.body);
    res.status(201).json(permit);
  }),
);
