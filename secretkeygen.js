import { randomBytes } from 'crypto';

const generateSecret = () => {
  return randomBytes(32).toString('hex');
};

console.log(generateSecret());
