export interface CountryId {
  countryId: string;
}

export interface ProvinceId {
  provinceId: string;
}

export interface MunicipalityId {
  municipalityId: string;
}

export interface ManualUpdateProgressParams {
  userId: string;
  courseId: string;
  type: 'class' | 'questionnaire';
  itemId: string;
  completed: boolean;
  score?: number;
}
