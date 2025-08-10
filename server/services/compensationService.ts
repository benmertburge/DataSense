import { storage } from '../storage';
import { encryptionService } from './encryptionService';
import type { CompensationCase, Journey, CompensationClaimRequest } from '@shared/schema';

export class CompensationService {
  private readonly DELAY_THRESHOLD_MINUTES = 20;
  private readonly COMPENSATION_RATE_PER_MINUTE = 6.5; // SEK per minute delay

  async detectEligibility(userId: string, journeyId: string): Promise<CompensationCase | null> {
    const journey = await storage.getUserJourneys(userId, 100).then(journeys => 
      journeys.find(j => j.id === journeyId)
    );

    if (!journey || !journey.expectedArrival || !journey.plannedArrival) {
      return null;
    }

    const plannedArrival = new Date(journey.plannedArrival);
    const expectedArrival = new Date(journey.expectedArrival);
    const delayMinutes = Math.round((expectedArrival.getTime() - plannedArrival.getTime()) / 60000);

    if (delayMinutes < this.DELAY_THRESHOLD_MINUTES) {
      return null;
    }

    const estimatedAmount = this.calculateCompensation(delayMinutes, "period"); // Assume period pass

    const compensationCase = await storage.createCompensationCase({
      userId,
      journeyId,
      delayMinutes,
      eligibilityThreshold: this.DELAY_THRESHOLD_MINUTES,
      estimatedAmount: estimatedAmount.toString(),
      status: "detected",
    });

    return compensationCase;
  }

  async submitClaim(
    caseId: string, 
    claimData: CompensationClaimRequest,
    evidenceFiles?: Array<{ id: string; type: string; filename: string }>
  ): Promise<{ case: CompensationCase; slFormUrl: string }> {
    const compensationCase = await storage.getCompensationCase(caseId);
    if (!compensationCase) {
      throw new Error("Compensation case not found");
    }

    // Encrypt sensitive personal data
    const encryptedData = await encryptionService.encrypt(JSON.stringify({
      firstName: claimData.firstName,
      lastName: claimData.lastName,
      email: claimData.email,
      phone: claimData.phone,
      paymentMethod: claimData.paymentMethod,
      paymentDetails: claimData.paymentDetails,
      ticketType: claimData.ticketType,
    }));

    // Generate SL form URL with pre-filled data
    const slFormUrl = this.generateSLFormUrl(compensationCase, claimData);

    // Update case
    const updatedCase = await storage.updateCompensationCase(caseId, {
      encryptedPersonalData: encryptedData,
      evidenceIds: evidenceFiles?.map(f => f.id) || [],
      slFormUrl,
      status: "submitted",
      submittedAt: new Date(),
      actualAmount: this.calculateCompensation(
        compensationCase.delayMinutes, 
        claimData.ticketType
      ).toString(),
    });

    return { case: updatedCase, slFormUrl };
  }

  private generateSLFormUrl(compensationCase: CompensationCase, claimData: CompensationClaimRequest): string {
    // SL's actual compensation form URL
    const baseUrl = "https://sl.se/sv/kundservice/ersattning-fordrojning";
    
    // In real implementation, we would use SL's API or form automation
    // For now, return the form URL with case reference
    return `${baseUrl}?ref=${compensationCase.id}&delay=${compensationCase.delayMinutes}&type=${claimData.ticketType}`;
  }

  private calculateCompensation(delayMinutes: number, ticketType: string): number {
    let baseAmount = delayMinutes * this.COMPENSATION_RATE_PER_MINUTE;
    
    // Adjust based on ticket type
    switch (ticketType) {
      case "single":
        baseAmount *= 0.5;
        break;
      case "7-day":
        baseAmount *= 0.8;
        break;
      case "30-day":
        baseAmount *= 1.0;
        break;
      case "annual":
        baseAmount *= 1.2;
        break;
      default:
        baseAmount *= 1.0;
    }

    return Math.round(baseAmount);
  }

  async fillSLForm(
    compensationCase: CompensationCase, 
    claimData: CompensationClaimRequest
  ): Promise<{ success: boolean; formData: any }> {
    // In real implementation, this would use browser automation (Playwright/Puppeteer)
    // to fill SL's actual web form with the user's data
    
    const formData = {
      // Personal information
      firstName: claimData.firstName,
      lastName: claimData.lastName,
      email: claimData.email,
      phone: claimData.phone,
      
      // Journey details
      delayMinutes: compensationCase.delayMinutes,
      ticketType: claimData.ticketType,
      compensationAmount: this.calculateCompensation(compensationCase.delayMinutes, claimData.ticketType),
      
      // Payment details
      paymentMethod: claimData.paymentMethod,
      paymentDetails: claimData.paymentDetails,
      
      // Case reference
      caseId: compensationCase.id,
      submissionDate: new Date().toISOString(),
    };

    // TODO: Implement actual form automation when integrating with SL
    // This would involve:
    // 1. Opening SL's compensation form
    // 2. Filling in all the fields programmatically
    // 3. Uploading any evidence files
    // 4. Submitting the form
    // 5. Capturing the confirmation/reference number
    
    return { success: true, formData };
  }

  async getClaimStatus(caseId: string): Promise<CompensationCase | null> {
    const compensationCase = await storage.getCompensationCase(caseId);
    return compensationCase || null;
  }

  async processAutomaticDetection(userId: string): Promise<CompensationCase[]> {
    const recentJourneys = await storage.getUserJourneys(userId, 10);
    const detectedCases: CompensationCase[] = [];

    for (const journey of recentJourneys) {
      const delayMinutes = journey.delayMinutes || 0;
      if (journey.status === "completed" && delayMinutes >= this.DELAY_THRESHOLD_MINUTES) {
        // Check if case already exists
        const existingCases = await storage.getUserCompensationCases(userId);
        const exists = existingCases.some(c => c.journeyId === journey.id);
        
        if (!exists) {
          const newCase = await this.detectEligibility(userId, journey.id);
          if (newCase) {
            detectedCases.push(newCase);
          }
        }
      }
    }

    return detectedCases;
  }
}

export const compensationService = new CompensationService();
