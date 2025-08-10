import PDFDocument from 'pdfkit';
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
  ): Promise<{ case: CompensationCase; pdfUrl: string }> {
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

    // Generate PDF
    const pdfBuffer = await this.generateClaimPDF(compensationCase, claimData);
    const pdfUrl = await this.uploadPDF(pdfBuffer, caseId);

    // Update case
    const updatedCase = await storage.updateCompensationCase(caseId, {
      encryptedPersonalData: encryptedData,
      evidenceIds: evidenceFiles?.map(f => f.id) || [],
      pdfUrl,
      status: "submitted",
      submittedAt: new Date(),
      actualAmount: this.calculateCompensation(
        compensationCase.delayMinutes, 
        claimData.ticketType
      ).toString(),
    });

    return { case: updatedCase, pdfUrl };
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

  private async generateClaimPDF(
    compensationCase: CompensationCase, 
    claimData: CompensationClaimRequest
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('Compensation Claim', 50, 50);
      doc.fontSize(12).text(`Claim ID: ${compensationCase.id}`, 50, 80);
      doc.text(`Generated: ${new Date().toLocaleDateString('sv-SE')}`, 50, 95);

      // Claimant Information
      doc.fontSize(14).text('Claimant Information', 50, 130);
      doc.fontSize(10)
        .text(`Name: ${claimData.firstName} ${claimData.lastName}`, 50, 150)
        .text(`Email: ${claimData.email}`, 50, 165)
        .text(`Phone: ${claimData.phone || 'Not provided'}`, 50, 180)
        .text(`Payment Method: ${claimData.paymentMethod}`, 50, 195);

      // Journey Details
      doc.fontSize(14).text('Journey Details', 50, 230);
      doc.fontSize(10)
        .text(`Date: ${new Date().toLocaleDateString('sv-SE')}`, 50, 250)
        .text(`Delay: ${compensationCase.delayMinutes} minutes`, 50, 265)
        .text(`Ticket Type: ${claimData.ticketType}`, 50, 280)
        .text(`Estimated Compensation: ${compensationCase.estimatedAmount} SEK`, 50, 295);

      // Legal Notice
      doc.fontSize(8).text(
        'This claim is submitted in accordance with EU Regulation 261/2004 and Swedish transport legislation. ' +
        'Personal data is processed securely and will be deleted after processing unless required by law.',
        50, 350, { width: 500 }
      );

      // Signature line
      doc.fontSize(10).text('Signature: ________________________', 50, 400);
      doc.text(`Date: ${new Date().toLocaleDateString('sv-SE')}`, 50, 420);

      doc.end();
    });
  }

  private async uploadPDF(pdfBuffer: Buffer, caseId: string): Promise<string> {
    // In production, upload to cloud storage (S3, etc.)
    // For now, return a mock URL
    return `/api/compensation/cases/${caseId}/pdf`;
  }

  async getClaimStatus(caseId: string): Promise<CompensationCase | null> {
    return await storage.getCompensationCase(caseId);
  }

  async processAutomaticDetection(userId: string): Promise<CompensationCase[]> {
    const recentJourneys = await storage.getUserJourneys(userId, 10);
    const detectedCases: CompensationCase[] = [];

    for (const journey of recentJourneys) {
      if (journey.status === "completed" && journey.delayMinutes >= this.DELAY_THRESHOLD_MINUTES) {
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
