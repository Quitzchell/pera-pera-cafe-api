export class CreateSessionDto {
  title: string;
  targetLanguage: string;
  host: {
    displayName: string;
    nativeLanguage: string;
    proficiencyLevels: string[];
  };
}