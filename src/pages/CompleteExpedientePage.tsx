import { RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { mapApiError } from "../lib/errorMapper";
import { useDocumentValidation } from "../hooks/useDocumentValidation";
import { useExpediente } from "../hooks/useExpediente";
import { AlertMessage } from "../components/common/AlertMessage";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { ProcessStepper } from "../components/common/ProcessStepper";
import { SecurityNotice } from "../components/common/SecurityNotice";
import { StatusCard } from "../components/common/StatusCard";
import { PageContainer } from "../components/layout/PageContainer";
import { AttemptCounter } from "../components/document/AttemptCounter";
import { DocumentUploader } from "../components/document/DocumentUploader";
import { FileRequirements } from "../components/document/FileRequirements";
import { AlreadyCompleted } from "../components/status/AlreadyCompleted";
import { ExpiredLink } from "../components/status/ExpiredLink";
import { InvalidLink } from "../components/status/InvalidLink";
import { SuccessResult } from "../components/status/SuccessResult";
import { ValidationError } from "../components/status/ValidationError";
import { ApiError } from "../types/api";
import { MaskedDocumentNumber } from "../components/common/MaskedDocumentNumber";

const recommendations = [
  "Coloca la cédula sobre una superficie plana.",
  "Asegúrate de que todos los bordes sean visibles.",
  "Evita reflejos, sombras y poca iluminación."
];

const PendingExpediente = ({
  expediente,
  token
}: {
  expediente: NonNullable<ReturnType<typeof useExpediente>["expediente"]>;
  token: string;
}) => {
  const validation = useDocumentValidation(expediente, token);

  if (validation.status === "completed" && validation.registrationResult) {
    return (
      <>
        <ProcessStepper activeStep={3} completed />
        <SuccessResult result={validation.registrationResult} />
      </>
    );
  }

  if (validation.status === "max-attempts") {
    return (
      <>
        <ProcessStepper activeStep={2} />
        <StatusCard
          title="Alcanzaste el máximo de intentos"
          message="No fue posible validar el documento de identidad. Recibirás una nueva comunicación con información para continuar el proceso."
          tone="error"
        />
      </>
    );
  }

  const processing = validation.processing;

  return (
    <>
      <ProcessStepper activeStep={2} processing={processing} />
      <section className="mx-auto grid max-w-6xl items-start gap-7 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-xl border border-[#DDE6F0] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-black uppercase text-mercantil-blue">Datos del expediente</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950">
            Cédula de identidad
          </h1>

          <dl className="mt-7 space-y-4 text-sm">
            {expediente.nombreTomador ? (
              <div className="rounded-xl bg-[#F8FAFC] p-4">
                <dt className="font-black uppercase text-slate-500">Tomador</dt>
                <dd className="mt-1 text-base font-bold text-slate-950">
                  {expediente.nombreTomador}
                </dd>
              </div>
            ) : null}
            {expediente.numeroDocumentoEsperado ? (
              <div className="rounded-xl bg-[#F8FAFC] p-4">
                <dt className="font-black uppercase text-slate-500">Documento</dt>
                <dd className="mt-1 text-base font-bold text-slate-950">
                  <MaskedDocumentNumber value={expediente.numeroDocumentoEsperado} />
                </dd>
              </div>
            ) : null}
            <div className="rounded-xl bg-[#F8FAFC] p-4">
              <dt className="font-black uppercase text-slate-500">Estado</dt>
              <dd className="mt-1 text-base font-bold text-mercantil-blue">Pendiente</dd>
            </div>
          </dl>

          <div className="mt-5">
            <AttemptCounter attempts={validation.attempts} />
          </div>
        </aside>

        <div className="rounded-xl border border-[#DDE6F0] bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.09)] sm:p-7">
          <div className="mb-6 border-b border-[#E7ECF3] pb-5">
            <p className="text-sm font-black uppercase text-mercantil-blue">
              Adjuntar documento
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">Carga el archivo</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Selecciona una imagen o PDF legible.
            </p>
          </div>

          <div className="space-y-5">
            <FileRequirements />

            <DocumentUploader
              disabled={validation.attempts.remaining <= 0}
              processing={processing}
              onSubmit={validation.submitDocument}
              onFileChange={validation.resetRecoverableError}
            />

            {validation.validationResult && validation.status === "validation-error" ? (
              <ValidationError result={validation.validationResult} />
            ) : null}

            {validation.status === "service-error" ? (
              <AlertMessage tone="error">
                <p className="font-bold">{mapApiError(validation.error).title}</p>
                <p className="mt-1">{mapApiError(validation.error).message}</p>
              </AlertMessage>
            ) : null}

            {processing ? (
              <LoadingScreen
                title={
                  validation.status === "registering"
                    ? "Registrando e indexando el documento"
                    : "Validación en proceso"
                }
                message={`${validation.processingMessage} No cierres esta ventana.`}
              />
            ) : null}

            <div className="grid gap-4">
              <div className="rounded-xl border border-[#E7ECF3] bg-white p-5">
                <h2 className="font-black text-mercantil-navy">Recomendaciones</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  {recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <SecurityNotice />
          </div>
        </div>
      </section>
    </>
  );
};

export const CompleteExpedientePage = () => {
  const [params] = useSearchParams();
  const tomadorId = params.get("tomadorId");
  const token = params.get("token");
  const { expediente, loading, error, retry } = useExpediente(tomadorId, token);

  if (!tomadorId || !token) {
    return (
      <PageContainer>
        <ProcessStepper activeStep={1} />
        <InvalidLink />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <ProcessStepper activeStep={1} />
        <LoadingScreen title="Consultando expediente" message="Estamos verificando la información del enlace." />
      </PageContainer>
    );
  }

  if (error) {
    if (error instanceof ApiError && error.code === "EXPIRED_LINK") {
      return (
        <PageContainer>
          <ProcessStepper activeStep={1} />
          <ExpiredLink />
        </PageContainer>
      );
    }

    const friendly = mapApiError(error);
    return (
      <PageContainer>
        <ProcessStepper activeStep={1} />
        <StatusCard
          title={friendly.title}
          message={friendly.message}
          tone="error"
          actions={
            <button
              type="button"
              onClick={() => void retry()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mercantil-blue px-5 py-3 font-semibold text-white hover:bg-mercantil-navy"
            >
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              Reintentar consulta
            </button>
          }
        />
      </PageContainer>
    );
  }

  if (!expediente) {
    return (
      <PageContainer>
        <ProcessStepper activeStep={1} />
        <InvalidLink />
      </PageContainer>
    );
  }

  if (expediente.expedienteCompletado) {
    return (
      <PageContainer>
        <ProcessStepper activeStep={3} completed />
        <AlreadyCompleted expediente={expediente} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PendingExpediente expediente={expediente} token={token} />
    </PageContainer>
  );
};
