import AuthController from './auth.controller';
import UserController from './user.controller';
import CategoryController from './category.controller';
import CourseController from './course.controller';
import ClassController from './class.controller';
import FileController from './file.controller';
import IWantToTrainController from './iwanttotrain.controller';
import RequestACourseController from './requestACourse.controller';
import PaymentController from './payment.controller';
import BankAccountController from './bankAccount.controller';
import BusinessTrainingController from './businessTraining.controller';
import CompanySpecificDataController from './companySpecificData.controller';
import FAQController from './faq.controller';
import CertificateController from './certificate.controller';
import PromotionalCodeController from './promotionalCode.controller';
import QuestionnaireController from './questionnaire.controller';
import QuestionnaireSubmissionController from './questionnaireSubmission.controller';
import { courseProgressController } from './courseProgress.controller';
import NotificationController from './notification.controller';
import SupportTicketController from './supportTicket.controller';

import {
  authService,
  userService,
  categoryService,
  courseService,
  classService,
  fileService,
  iWantToTrainService,
  requestACourseService,
  paymentService,
  bankAccountService,
  businessTrainingService,
  companySpecificDataService,
  faqService,
  certificateService,
  promotionalCodeService,
  questionnaireService,
  questionnaireSubmissionService,
  notificationService,
  supportTicketService,
} from '@/services';

export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const categoryController = new CategoryController(categoryService);
export const courseController = new CourseController(courseService);
export const classController = new ClassController(classService, courseService);
export const fileController = new FileController(fileService);
export const iWantToTrainController = new IWantToTrainController(iWantToTrainService);
export const requestACourseController = new RequestACourseController(requestACourseService);
export const paymentController = new PaymentController(paymentService);
export const bankAccountController = new BankAccountController(bankAccountService);
export const businessTrainingController = new BusinessTrainingController(businessTrainingService);
export const companySpecificDataController = new CompanySpecificDataController(companySpecificDataService);
export const faqController = new FAQController(faqService);
export const certificateController = new CertificateController(certificateService);
export const promotionalCodeController = new PromotionalCodeController(promotionalCodeService);
export const questionnaireController = new QuestionnaireController(questionnaireService);
export const questionnaireSubmissionController = new QuestionnaireSubmissionController(questionnaireSubmissionService);
export const notificationController = new NotificationController(notificationService);
export const supportTicketController = new SupportTicketController(supportTicketService);
export { courseProgressController };
