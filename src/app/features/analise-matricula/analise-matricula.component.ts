import { Component, viewChild, signal, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { AnaliseLoadingComponent } from '../../shared/components/analise-loading/analise-loading.component';
import { AuthService } from '../../core/services/auth.service';
import {
  MatriculaAnalysisService,
  type AnalyzeResult,
  type MatriculaReportJson,
} from '../../core/services/matricula-analysis.service';

@Component({
  selector: 'app-analise-matricula',
  standalone: true,
  imports: [HeaderComponent, AnaliseLoadingComponent, RouterLink],
  templateUrl: './analise-matricula.component.html',
  styleUrl: './analise-matricula.component.css',
})
export class AnaliseMatriculaComponent {
  protected readonly analyzing = signal(false);
  protected readonly selectedFileName = signal('');
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly result = signal<AnalyzeResult | null>(null);
  /** Relatório completo (resumo, linha do tempo, ônus, etc.) para exibir em tela. */
  protected readonly report = signal<MatriculaReportJson | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly auth = inject(AuthService);
  private readonly matriculaService = inject(MatriculaAnalysisService);
  private fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

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
      this.result.set(null);
    }
    input.value = '';
  }

  protected async startAnalysis(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    const user = this.auth.currentUser();
    if (!user?.id) {
      this.errorMessage.set('Faça login para analisar uma matrícula.');
      return;
    }

    this.analyzing.set(true);
    this.errorMessage.set(null);
    this.result.set(null);

    try {
      const res = await this.matriculaService.uploadAndAnalyze(file, user.id);
      this.result.set(res);
      this.selectedFile.set(null);
      this.selectedFileName.set('');
      const full = await this.matriculaService.getReport(res.job_id);
      this.report.set(full?.report_json ?? null);
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
    this.result.set(null);
    this.report.set(null);
  }
}
