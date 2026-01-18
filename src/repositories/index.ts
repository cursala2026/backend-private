import generalConnection from '../config/databases';

import UserRepository from './user.repository';
import CategoryRepository from './category.repository';
import CourseRepository from './course.repository';
import ClassRepository from './class.repository';
import IWantToTrainRepository from './iwanttotrain.repository';
import RequestACourseRepository from './requestACourse.repository';
import PaymentRepository from './payment.repository';
import BankAccountsRepository from './bankAccount.repository';
import BusinessTrainingRepository from './businessTraining.repository';
import CompanySpecificDataRepository from './companySpecificData.repository';
import MercadoPagoRepository from './mercadoPago.repository';
import FAQRepository from './faq.repository';
import FileMaterialRepository from './fileMaterial.repository';
import CertificateRepository from './certificate.repository';
import QuestionnaireRepository from './questionnaire.repository';
import QuestionnaireSubmissionRepository from './questionnaireSubmission.repository';
import SupportTicketRepository from './supportTicket.repository';

export const userRepository = new UserRepository(generalConnection);
export const categoryRepository = new CategoryRepository(generalConnection);
export const courseRepository = new CourseRepository(generalConnection);
export const classRepository = new ClassRepository(generalConnection);
export const iWantToTrainRepository = new IWantToTrainRepository(generalConnection);
export const requestACourseRepository = new RequestACourseRepository(generalConnection);
export const paymentRepository = new PaymentRepository(generalConnection);
export const bankAccountsRepository = new BankAccountsRepository(generalConnection);
export const businessTrainingRepository = new BusinessTrainingRepository(generalConnection);
export const companySpecificDataRepository = new CompanySpecificDataRepository(generalConnection);
export const mercadoPagoRepository = new MercadoPagoRepository(generalConnection);
export const faqRepository = new FAQRepository(generalConnection);
export const fileMaterialRepository = new FileMaterialRepository(generalConnection);
export const certificateRepository = new CertificateRepository(generalConnection);
export const questionnaireRepository = new QuestionnaireRepository(generalConnection);
export const questionnaireSubmissionRepository = new QuestionnaireSubmissionRepository(generalConnection);
export const supportTicketRepository = new SupportTicketRepository(generalConnection);

// Re-export singleton repository
export { courseProgressRepository } from './courseProgress.repository';
