import { Component, viewChild, signal, ElementRef, inject, ChangeDetectorRef, AfterViewChecked, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { AnaliseLoadingComponent } from '../../shared/components/analise-loading/analise-loading.component';
import { AuthService } from '../../core/services/auth.service';
import { DocumentAnalysisOrchestratorService } from '../../core/services/document-analysis-orchestrator.service';
import type {
  PipelineStep,
  UnifiedReport,
} from '../../core/services/document-analysis-orchestrator.service';
import { ApiService } from '../../core/services/api.service';
import { IptuMunicipiosService } from '../../core/services/iptu-municipios.service';
import {
  ChatMatriculaService,
  type ChatMessage,
  type ChatCitation,
} from '../../core/services/chat-matricula.service';

@Component({
  selector: 'app-analise-matricula',
  standalone: true,
  imports: [HeaderComponent, AnaliseLoadingComponent, RouterLink, FormsModule],
  templateUrl: './analise-matricula.component.html',
  styleUrl: './analise-matricula.component.css',
})
export class AnaliseMatriculaComponent implements AfterViewChecked {
  protected readonly analyzing = signal(false);
  protected readonly selectedFileName = signal('');
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly steps = signal<PipelineStep[]>([]);
  protected readonly currentStepLabel = signal('Analisando documento');
  protected readonly unifiedReport = signal<UnifiedReport | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected assistedTextoColado = '';
  protected assistedAnexo: File | null = null;
  protected assistedEvidenceSaved = signal(false);
  protected assistedEvidencePreview = signal<{ texto?: string; anexo?: string } | null>(null);
  protected assistedLoading = signal(false);
  protected assistedError = signal<string | null>(null);
  protected copyFeedback = signal<string | null>(null);
  protected portalUrl = signal<string | null>(null);
  protected shouldScrollToIptu = signal(false);

  protected chatOpen = signal(false);
  protected chatMessages = signal<ChatMessage[]>([]);
  protected chatInput = '';
  protected chatLoading = signal(false);
  protected chatError = signal<string | null>(null);
  protected chatWelcomeSent = signal(false);

  protected readonly QUICK_QUESTIONS = [
    'Resuma os principais riscos',
    'Existe alienação, hipoteca ou ônus?',
    'Quem é o proprietário?',
    'O que devo verificar antes de arrematar?',
    'Liste pendências e próximos passos',
  ] as const;

  private readonly auth = inject(AuthService);
  private readonly orchestrator = inject(DocumentAnalysisOrchestratorService);
  private readonly api = inject(ApiService);
  private readonly iptuMunicipios = inject(IptuMunicipiosService);
  private readonly chatService = inject(ChatMatriculaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected iptuSectionRef = viewChild<ElementRef<HTMLElement>>('iptuSection');

  constructor() {
    effect(() => {
      const report = this.unifiedReport();
      if (report?.iptuStatus === 'assisted') {
        this.shouldScrollToIptu.set(true);
        const url = report.iptuStrategy?.url;
        if (url) {
          this.portalUrl.set(url);
        } else if (report.iptuPrefilled) {
          this.loadPortalUrlFromMunicipios(report.iptuPrefilled.uf, report.iptuPrefilled.municipio);
        }
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToIptu()) {
      this.shouldScrollToIptu.set(false);
      setTimeout(() => {
        this.iptuSectionRef()?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  private async loadPortalUrlFromMunicipios(uf: string, municipio: string): Promise<void> {
    const strategy = await this.iptuMunicipios.getStrategy(uf, municipio);
    if (strategy?.consulta_url) this.portalUrl.set(strategy.consulta_url);
  }

  protected canRegisterEvidence(): boolean {
    return !!(this.assistedTextoColado.trim() || this.assistedAnexo);
  }

  protected async copyToClipboard(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copyFeedback.set(label);
      setTimeout(() => this.copyFeedback.set(null), 2000);
      this.cdr.markForCheck();
    } catch {
      this.copyFeedback.set('Erro ao copiar');
      setTimeout(() => this.copyFeedback.set(null), 2000);
      this.cdr.markForCheck();
    }
  }

  protected getPortalUrl(): string | null {
    return this.portalUrl() ?? this.unifiedReport()?.iptuStrategy?.url ?? null;
  }

  protected getGoogleSearchFallback(): string {
    const prefilled = this.unifiedReport()?.iptuPrefilled;
    if (!prefilled) return "IPTU 2ª via";
    return `IPTU 2ª via ${prefilled.municipio} ${prefilled.uf}`;
  }

  protected openPortal(): void {
    const url = this.getPortalUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  protected copyGoogleSearch(): void {
    this.copyToClipboard(this.getGoogleSearchFallback(), 'Busca copiada');
  }

  protected openFileDialog(): void {
    this.fileInputRef()?.nativeElement?.click();
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectedFile.set(file);
      this.selectedFileName.set(file.name);
      this.errorMessage.set(null);
      this.unifiedReport.set(null);
    }
    input.value = '';
  }

  protected async startAnalysis(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    const user = this.auth.currentUser();
    if (!user?.id) {
      this.errorMessage.set('Faça login para analisar.');
      return;
    }

    this.analyzing.set(true);
    this.errorMessage.set(null);
    this.unifiedReport.set(null);
    this.steps.set([]);
    this.assistedEvidenceSaved.set(false);
    this.selectedFile.set(null);
    this.selectedFileName.set('');

    try {
      const report = await this.orchestrator.run(file, user.id, (step) => {
        this.steps.update((list) => {
          const idx = list.findIndex((s) => s.id === step.id);
          const next = [...list];
          if (idx >= 0) next[idx] = step;
          else next.push(step);
          return next;
        });
        this.currentStepLabel.set(step.label + (step.detail ? ` — ${step.detail}` : ''));
        this.cdr.markForCheck();
      });
      this.unifiedReport.set(report);
    } catch (e) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Erro ao analisar. Tente novamente.');
    } finally {
      this.analyzing.set(false);
    }
  }

  protected clearFile(): void {
    this.selectedFile.set(null);
    this.selectedFileName.set('');
    this.errorMessage.set(null);
    this.unifiedReport.set(null);
    this.steps.set([]);
    this.assistedTextoColado = '';
    this.assistedAnexo = null;
    this.assistedEvidenceSaved.set(false);
    this.assistedEvidencePreview.set(null);
    this.assistedError.set(null);
    this.portalUrl.set(null);
    this.chatOpen.set(false);
    this.chatMessages.set([]);
    this.chatWelcomeSent.set(false);
  }

  protected async openChat(): Promise<void> {
    const report = this.unifiedReport();
    if (!report?.analysisJobId) return;

    this.chatOpen.set(true);
    this.chatError.set(null);

    try {
      const history = await this.chatService.getHistory(report.analysisJobId);
      this.chatMessages.set(history);

      if (history.length === 0 && !this.chatWelcomeSent()) {
        this.chatWelcomeSent.set(true);
        this.chatMessages.update((msgs) => [
          ...msgs,
          {
            role: 'assistant',
            content: 'Posso te ajudar a interpretar esta matrícula. O que você quer saber?',
            citations: [],
          },
        ]);
      }
    } catch {
      this.chatError.set('Erro ao carregar histórico');
    }
    this.cdr.markForCheck();
  }

  protected async sendChatMessage(text?: string): Promise<void> {
    const report = this.unifiedReport();
    const msg = (text ?? this.chatInput.trim()).slice(0, 2000);
    if (!report?.analysisJobId || !msg) return;

    this.chatMessages.update((msgs) => [...msgs, { role: 'user', content: msg }]);
    this.chatInput = '';
    this.chatLoading.set(true);
    this.chatError.set(null);
    this.cdr.markForCheck();

    try {
      const result = await this.chatService.sendMessage(report.analysisJobId, msg);
      this.chatMessages.update((msgs) => [
        ...msgs,
        { role: 'assistant', content: result.reply, citations: result.citations },
      ]);
    } catch (e) {
      this.chatError.set(e instanceof Error ? e.message : 'Erro ao enviar');
      this.chatMessages.update((msgs) => msgs.slice(0, -1));
    } finally {
      this.chatLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected getSuggestedQuestion(): string | null {
    const report = this.unifiedReport();
    if (report?.iptuStatus === 'assisted') {
      return 'Quer que eu monte um checklist do que falta confirmar no portal?';
    }
    return null;
  }

  protected onAssistedAnexoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.assistedAnexo = input.files?.[0] ?? null;
  }

  protected async submitAssistedEvidence(): Promise<void> {
    const report = this.unifiedReport();
    const user = this.auth.currentUser();
    if (!report?.analysisJobId || !user?.id || !this.canRegisterEvidence()) return;

    this.assistedLoading.set(true);
    this.assistedError.set(null);

    try {
      let anexoPath: string | undefined;
      if (this.assistedAnexo) {
        const uploaded = await this.api.uploadFile<{ path: string }>('storage/matriculas', this.assistedAnexo);
        anexoPath = uploaded.path;
      }

      await this.orchestrator.saveAssistedEvidence(
        report.analysisJobId,
        user.id,
        this.assistedTextoColado.trim() || undefined,
        anexoPath
      );
      this.assistedEvidenceSaved.set(true);
      this.assistedEvidencePreview.set({
        texto: this.assistedTextoColado.trim()
          ? this.assistedTextoColado.trim().slice(0, 150) + (this.assistedTextoColado.length > 150 ? '…' : '')
          : undefined,
        anexo: this.assistedAnexo?.name,
      });
    } catch (e) {
      this.assistedError.set(e instanceof Error ? e.message : 'Erro ao registrar evidência');
    } finally {
      this.assistedLoading.set(false);
      this.cdr.markForCheck();
    }
  }
}
