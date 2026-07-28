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

const recommendations = [
  "Coloca la cédula sobre una superficie plana.",
  "Verifica que todos los bordes sean visibles.",
  "Evita reflejos, sombras y poca iluminación.",
  "Carga un archivo donde los datos puedan leerse con claridad."
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
      <section className="rounded-lg border border-mercantil-border bg-white p-6 shadow-portal sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-mercantil-blue">
            Expediente pendiente
          </p>
          <h1 className="mt-2 text-2xl font-bold text-mercantil-navy">
            {expediente.nombreTomador ? `Hola, ${expediente.nombreTomador}` : "Completa tu expediente"}
          </h1>
          <p className="mt-3 leading-7 text-mercantil-text">
            Para continuar necesitamos recibir una imagen o PDF de la cédula de identidad
            venezolana asociada a este expediente.
          </p>
        </div>

        <div className="space-y-5">
          <FileRequirements />
          <AttemptCounter attempts={validation.attempts} />

          <div className="rounded-md border border-mercantil-border bg-white p-4">
            <h2 className="font-semibold text-mercantil-navy">Recomendaciones</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-mercantil-text">
              {recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

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

          <DocumentUploader
            disabled={validation.attempts.remaining <= 0}
            processing={processing}
            onSubmit={validation.submitDocument}
            onFileChange={validation.resetRecoverableError}
          />
          <SecurityNotice />
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
