from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    firebase_project_id: str
    cors_origins: str = "http://localhost:3000"
    admin_uids: str = ""
    # 유료 기능(카드 사진)을 쓸 수 있는 uid 목록(콤마). 결제를 붙이기 전까지는 손으로 넣는다.
    premium_uids: str = ""
    # 카드 사진 저장소(Cloudflare R2). 넷 중 하나라도 비면 사진 기능이 꺼진다.
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def admin_uid_list(self) -> list[str]:
        return [uid.strip() for uid in self.admin_uids.split(",") if uid.strip()]

    @property
    def premium_uid_list(self) -> list[str]:
        return [uid.strip() for uid in self.premium_uids.split(",") if uid.strip()]

    @property
    def r2_configured(self) -> bool:
        return all(
            (self.r2_account_id, self.r2_access_key_id, self.r2_secret_access_key, self.r2_bucket)
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
