import { Eye, ArrowDownToLine, ShieldAlert, Smartphone, HardHat, Shirt, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";

type AssetListItem = {
  id: string;
  employee_no: string | null;
  employee_code?: string | null;
  recruitment_candidate: { full_name_ar: string; full_name_en: string | null; passport_no: string; nationality: string } | null;
  assets: Array<{
    id: string;
    status_code: string;
    receive_date: string;
    condition_code: string;
    asset: { id: string; type: string; name: string; price: string; vehicle_id: string | null; license_plate?: string };
    created_at: string;
    updated_at?: string;
  }>;
  contract_end_at: string | null;
};

export function AssetsTable({
  locale,
  items,
  onView,
  onReceive,
  onLossReport,
}: {
  locale: string;
  items: AssetListItem[];
  onView: (id: string) => void;
  onReceive: (id: string) => void;
  onLossReport: (id: string) => void;
}) {
  const t = useTranslations();

  const getStatus = (assets: AssetListItem['assets']) => {
    if (assets.some(a => a.status_code === 'DAMAGED' || a.status_code === 'LOST')) return 'DAMAGED';
    if (assets.length > 0) return 'ACTIVE';
    return null;
  };

  const getOtherAssetIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'PHONE': return <Smartphone className="h-4 w-4" />;
      case 'HELMET': return <HardHat className="h-4 w-4" />;
      case 'VEST': return <Shirt className="h-4 w-4" />;
      case 'BAG': return <ShoppingBag className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-primary">
          <thead className="border-b border-zinc-200 text-left dark:border-zinc-700">
            <tr className={locale === "ar" ? "text-right" : "text-left"}>
              <th className="px-3 py-2">{t("assets.representative")}</th>
              <th className="px-3 py-2">{t("assets.employeeCode")}</th>
              <th className="px-3 py-2">{t("assets.mainAsset")}</th>
              <th className="px-3 py-2">{t("assets.otherAssets")}</th>
              <th className="px-3 py-2">{t("assets.totalAssetsValue")}</th>
              <th className="px-3 py-2">{t("assets.lastActionDate")}</th>
              <th className="px-3 py-2">{t("assets.status")}</th>
              <th className="px-3 py-2">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const totalValue = row.assets.reduce((sum, a) => sum + Number(a.asset.price ?? 0), 0);
              const mainAsset = row.assets.find(a => a.asset.type === 'VEHICLE' || a.asset.type === 'MOTORCYCLE');
              const otherAssets = row.assets.filter(a => a.asset.type !== 'VEHICLE' && a.asset.type !== 'MOTORCYCLE');
              const status = getStatus(row.assets);
              const lastActionDate = row.assets.reduce((latest, a) => {
                const date = new Date(a.updated_at || a.created_at || a.receive_date);
                return !latest || date > latest ? date : latest;
              }, null as Date | null);

              return (
                <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-700">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">
                          {row.recruitment_candidate?.full_name_en?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.recruitment_candidate?.full_name_ar}</span>
                        <span className="text-xs text-primary/60">{row.recruitment_candidate?.full_name_en}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium">{row.employee_code ?? row.employee_no ?? "-"}</td>
                  <td className="px-3 py-2">
                    {mainAsset ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{mainAsset.asset.name}</span>
                        {mainAsset.asset.license_plate && (
                          <span className="text-xs text-primary/60">{mainAsset.asset.license_plate}</span>
                        )}
                      </div>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {otherAssets.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">+{otherAssets.length}</span>
                        <div className="flex gap-1">
                          {Array.from(new Set(otherAssets.map(a => a.asset.type))).map(type => (
                            <span key={type} title={type}>
                              {getOtherAssetIcon(type)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2">{totalValue.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {lastActionDate ? format(lastActionDate, "yyyy-MM-dd") : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {status === 'ACTIVE' && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {t("assets.statusActive")}
                      </span>
                    )}
                    {status === 'DAMAGED' && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {t("assets.statusDamaged")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onView(row.id)}
                        className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        title={t("common.view")}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onReceive(row.id)}
                        className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        title={t("assets.receiveAsset")}
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onLossReport(row.id)}
                        className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        title={t("assets.newLossReport")}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-primary/60">
                  {t("common.noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
