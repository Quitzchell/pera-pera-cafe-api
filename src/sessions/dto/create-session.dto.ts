export class CreateSessionDto {
  title: string;
  targetLanguage: string;
  sourceLanguage: string;
  host: {
    displayName: string;
    nativeLanguage: string;
    proficiencyLevels: string[];
  };
}