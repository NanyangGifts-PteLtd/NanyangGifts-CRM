export default function OrderConfirmationLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section
        aria-live="polite"
        className="w-full max-w-md rounded-2xl border border-sky-100 bg-white px-9 py-11 text-center shadow-xl shadow-slate-200/60"
      >
        <div className="mx-auto mb-5 grid h-11 w-11 place-items-center rounded-xl bg-sky-500 text-xl font-extrabold text-white">
          N
        </div>
        <h1 className="text-lg font-semibold text-slate-900">
          Loading Order Confirmation Form
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Preparing the form and its artwork previews.
        </p>
        <div
          aria-label="Loading"
          className="mx-auto mt-6 h-7 w-7 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500"
        />
      </section>
    </main>
  );
}
