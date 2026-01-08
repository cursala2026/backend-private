import AuthService from './auth.service';
import UserService from './user.service';
import CategoryService from './category.service';
import CourseService from './course.service';
import ClassService from './class.service';
import FileService from './file.service';
import IWantToTrainService from './iwanttotrain.service';
import RequestACourseService from './requestACourse.service';
import PaymentService from './payment.service';
import BankAccountService from './bankAccount.service';
import BusinessTrainingService from './businessTraining.service';
import CompanySpecificDataService from './companySpecificData.service';
import FAQService from './faq.service';
import { FileMaterialService } from './fileMaterial.service';
import adminSecurityService from './adminSecurity.service';
import CertificateService from './certificate.service';
import PromotionalCodeService from './promotionalCode.service';
import QuestionnaireService from './questionnaire.service';
import QuestionnaireSubmissionService from './questionnaireSubmission.service';
import QuestionMediaService from './questionMedia.service';
import NotificationService from './notification.service';
import SupportTicketService from './supportTicket.service';

import {
  userRepository,
  categoryRepository,
  courseRepository,
  classRepository,
  iWantToTrainRepository,
  requestACourseRepository,
  paymentRepository,
  bankAccountsRepository,
  businessTrainingRepository,
  companySpecificDataRepository,
  faqRepository,
  certificateRepository,
  questionnaireRepository,
  questionnaireSubmissionRepository,
  notificationRepository,
  supportTicketRepository,
} from '@/repositories';

export const authService = new AuthService(userRepository);
export const userService = new UserService(userRepository, courseRepository, certificateRepository);
export const categoryService = new CategoryService(categoryRepository);
// Instanciar notificationService antes para poder inyectarlo en CourseService
export const notificationService = new NotificationService(notificationRepository);
export const courseService = new CourseService(courseRepository, userRepository, notificationService);
export const classService = new ClassService(classRepository);
export const fileService = new FileService();
export const iWantToTrainService = new IWantToTrainService(iWantToTrainRepository);
export const requestACourseService = new RequestACourseService(requestACourseRepository);
export const paymentService = new PaymentService(paymentRepository);
export const bankAccountService = new BankAccountService(bankAccountsRepository);
export const businessTrainingService = new BusinessTrainingService(businessTrainingRepository);
export const companySpecificDataService = new CompanySpecificDataService(companySpecificDataRepository);
export const faqService = new FAQService(faqRepository);
export const fileMaterialService = new FileMaterialService();
export { adminSecurityService };
export const certificateService = new CertificateService(userRepository, courseRepository, certificateRepository);
export const promotionalCodeService = new PromotionalCodeService();
export const questionnaireService = new QuestionnaireService(questionnaireRepository, questionnaireSubmissionRepository);
export const questionnaireSubmissionService = new QuestionnaireSubmissionService(
  questionnaireSubmissionRepository,
  questionnaireRepository
);
export const questionMediaService = new QuestionMediaService();
export const supportTicketService = new SupportTicketService(supportTicketRepository);
