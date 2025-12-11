import config from '@/config';
import SecurityConnection from './mongo/security-connection';

const generalConnection = new SecurityConnection(config.DATABASE_URL).getConnection();

export default generalConnection;
